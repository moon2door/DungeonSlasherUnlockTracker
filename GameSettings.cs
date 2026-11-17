using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;

internal sealed class GameSettings
{
    private string? _bundlePath;
    private DateTime _bundleStamp;
    private byte[]? _password;

    internal byte[] GetPassword()
    {
        if (_bundlePath is null || !File.Exists(_bundlePath))
            _bundlePath = FindGameBundle();
        DateTime stamp = File.GetLastWriteTimeUtc(_bundlePath);
        if (_password is not null && _bundleStamp == stamp) return _password;
        byte[] updated;
        try
        {
            updated = ReadPasswordFromBundle(_bundlePath);
        }
        catch (Exception ex) when (ex is IOException or InvalidDataException or ArgumentException or OverflowException)
        {
            throw new ProgressReadException("설치된 게임의 세이브 설정을 읽을 수 없어요. Steam에서 게임 설치 상태를 확인해 주세요.");
        }
        if (_password is not null) CryptographicOperations.ZeroMemory(_password);
        _password = updated;
        _bundleStamp = stamp;
        return updated;
    }

    private static string FindGameBundle()
    {
        using RegistryKey? steamKey = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
        string? configuredRoot = steamKey?.GetValue("SteamPath") as string;
        string defaultRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam");
        var libraries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (string root in new[] { configuredRoot, defaultRoot }.OfType<string>())
        {
            libraries.Add(root);
            string file = Path.Combine(root, "steamapps", "libraryfolders.vdf");
            if (!File.Exists(file)) continue;
            foreach (Match match in Regex.Matches(File.ReadAllText(file), "\"path\"\\s*\"([^\"\\r\\n]+)\""))
                libraries.Add(match.Groups[1].Value.Replace(@"\\", @"\"));
        }
        foreach (string library in libraries)
        {
            string apps = Path.Combine(library, "steamapps");
            string manifest = Path.Combine(apps, "appmanifest_2712460.acf");
            string directory = "DUNGEON SLASHER";
            if (File.Exists(manifest))
            {
                Match match = Regex.Match(File.ReadAllText(manifest), "\"installdir\"\\s*\"([^\"\\r\\n]+)\"");
                if (match.Success) directory = match.Groups[1].Value;
            }
            string candidate = Path.Combine(apps, "common", directory, "dungeonslasher_Data", "data.unity3d");
            if (File.Exists(candidate)) return candidate;
        }
        throw new ProgressReadException("Steam에 설치된 던전슬래셔 데이터를 찾을 수 없어요. 게임의 설치 위치를 확인해 주세요.");
    }

    private static byte[] ReadPasswordFromBundle(string bundlePath)
    {
        using var stream = new FileStream(bundlePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new BinaryReader(stream);
        if (ReadCString(reader) != "UnityFS") throw new InvalidDataException("Unknown Unity archive");
        int version = ReadBigInt(reader);
        _ = ReadCString(reader);
        _ = ReadCString(reader);
        long bundleLength = ReadBigLong(reader);
        int packedSize = ReadBigInt(reader);
        int plainSize = ReadBigInt(reader);
        int flags = ReadBigInt(reader);
        if (bundleLength != stream.Length || packedSize is < 1 or > 16_777_216 || plainSize is < 1 or > 16_777_216)
            throw new InvalidDataException("Invalid archive header");

        if (version >= 7) AlignTo16(stream);
        long blockStart = stream.Position;
        if ((flags & 0x80) != 0) stream.Position = stream.Length - packedSize;
        byte[] directory = InflateBlock(reader.ReadBytes(packedSize), plainSize, flags);
        if ((flags & 0x80) != 0) stream.Position = blockStart;
        if ((flags & 0x200) != 0) AlignTo16(stream);

        using var index = new BinaryReader(new MemoryStream(directory));
        _ = index.ReadBytes(16);
        int blockCount = ReadBigInt(index);
        if (blockCount is < 1 or > 250_000) throw new InvalidDataException("Invalid archive block count");
        var blocks = new Block[blockCount];
        for (int i = 0; i < blocks.Length; i++)
        {
            int plain = ReadBigInt(index);
            int packed = ReadBigInt(index);
            int blockFlags = BinaryPrimitives.ReadUInt16BigEndian(index.ReadBytes(2));
            if (plain is < 1 or > 64 * 1024 * 1024 || packed is < 1 or > 64 * 1024 * 1024)
                throw new InvalidDataException("Invalid archive block");
            blocks[i] = new Block(plain, packed, blockFlags);
        }
        int nodeCount = ReadBigInt(index);
        if (nodeCount is < 1 or > 50_000) throw new InvalidDataException("Invalid archive directory");
        long assetOffset = -1;
        long assetLength = 0;
        for (int i = 0; i < nodeCount; i++)
        {
            long offset = ReadBigLong(index);
            long length = ReadBigLong(index);
            _ = ReadBigInt(index);
            string name = ReadCString(index);
            if (Path.GetFileName(name) != "resources.assets") continue;
            assetOffset = offset;
            assetLength = length;
            break;
        }
        if (assetOffset < 0 || assetLength <= 0) throw new InvalidDataException("Unity resources unavailable");
        long assetEnd = checked(assetOffset + assetLength);

        // Keep enough bytes to recognize a settings record crossing a block boundary.
        byte[] tail = [];
        long offsetInArchive = 0;
        foreach (Block block in blocks)
        {
            long end = offsetInArchive + block.PlainSize;
            if (end <= assetOffset)
            {
                stream.Seek(block.PackedSize, SeekOrigin.Current);
            }
            else if (offsetInArchive < assetEnd)
            {
                byte[] data = InflateBlock(reader.ReadBytes(block.PackedSize), block.PlainSize, block.Flags);
                int start = (int)Math.Max(assetOffset - offsetInArchive, 0);
                int count = (int)(Math.Min(end, assetEnd) - offsetInArchive) - start;
                byte[] search = new byte[tail.Length + count];
                tail.CopyTo(search, 0);
                data.AsSpan(start, count).CopyTo(search.AsSpan(tail.Length));
                if (FindSettingsPassword(search) is { } password) return password;
                tail = search.AsSpan(Math.Max(0, search.Length - 2048)).ToArray();
            }
            else break;
            offsetInArchive = end;
        }
        throw new InvalidDataException("Easy Save settings missing");
    }

    private static byte[]? FindSettingsPassword(ReadOnlySpan<byte> bytes)
    {
        // Serialized MonoBehaviour name, followed by the settings fields of ES3Defaults.
        ReadOnlySpan<byte> marker = "\x000b\0\0\0ES3Defaults"u8;
        for (int from = 0; from < bytes.Length;)
        {
            int relative = bytes[from..].IndexOf(marker);
            if (relative < 0) return null;
            int start = from + relative;
            from = start + marker.Length;
            int pathAt = start + 20;
            if (pathAt + 4 > bytes.Length) continue;
            int pathSize = BinaryPrimitives.ReadInt32LittleEndian(bytes[pathAt..]);
            if (pathSize is < 0 or > 1024) continue;
            int encryptionAt = pathAt + 4 + ((pathSize + 3) & ~3);
            if (encryptionAt + 12 > bytes.Length
                || BinaryPrimitives.ReadInt32LittleEndian(bytes[encryptionAt..]) != 1) continue;
            int passwordAt = encryptionAt + 12;
            int passwordSize = BinaryPrimitives.ReadInt32LittleEndian(bytes[(passwordAt - 4)..]);
            if (passwordSize is < 1 or > 512 || passwordAt + passwordSize > bytes.Length) continue;
            return bytes.Slice(passwordAt, passwordSize).ToArray();
        }
        return null;
    }

    private static byte[] InflateBlock(byte[] packed, int outputSize, int flags)
    {
        int compression = flags & 0x3f;
        if (compression == 0 && packed.Length == outputSize) return packed;
        if (compression is not (2 or 3)) throw new InvalidDataException("Unsupported Unity compression");
        // UnityFS stores raw LZ4 blocks, including LZ4HC, without a frame header.
        var output = new byte[outputSize];
        int consumed = 0, written = 0;
        while (consumed < packed.Length)
        {
            int token = packed[consumed++];
            int literals = ReadLength(packed, ref consumed, token >> 4);
            if (literals > packed.Length - consumed || literals > output.Length - written)
                throw new InvalidDataException("Truncated Unity block");
            packed.AsSpan(consumed, literals).CopyTo(output.AsSpan(written));
            consumed += literals;
            written += literals;
            if (consumed == packed.Length) break;
            if (packed.Length - consumed < 2) throw new InvalidDataException("Truncated Unity block offset");
            int distance = BinaryPrimitives.ReadUInt16LittleEndian(packed.AsSpan(consumed));
            consumed += 2;
            int match = ReadLength(packed, ref consumed, token & 0xf) + 4;
            if (distance == 0 || distance > written || match > output.Length - written)
                throw new InvalidDataException("Invalid Unity block match");
            for (int i = 0; i < match; i++) output[written + i] = output[written + i - distance];
            written += match;
        }
        if (written != output.Length) throw new InvalidDataException("Incomplete Unity block");
        return output;
    }

    private static int ReadLength(byte[] bytes, ref int position, int initial)
    {
        if (initial < 15) return initial;
        int length = initial;
        byte more;
        do
        {
            if (position >= bytes.Length) throw new InvalidDataException("Incomplete Unity block length");
            more = bytes[position++];
            length = checked(length + more);
        }
        while (more == 255);
        return length;
    }

    private static string ReadCString(BinaryReader reader)
    {
        Span<byte> text = stackalloc byte[1024];
        for (int length = 0; length < text.Length; length++)
        {
            byte value = reader.ReadByte();
            if (value == 0) return Encoding.UTF8.GetString(text[..length]);
            text[length] = value;
        }
        throw new InvalidDataException("Invalid Unity string");
    }

    private static int ReadBigInt(BinaryReader reader) => BinaryPrimitives.ReadInt32BigEndian(reader.ReadBytes(4));
    private static long ReadBigLong(BinaryReader reader) => BinaryPrimitives.ReadInt64BigEndian(reader.ReadBytes(8));
    private static void AlignTo16(Stream stream) => stream.Position = (stream.Position + 15) & ~15L;
    private readonly record struct Block(int PlainSize, int PackedSize, int Flags);
}
