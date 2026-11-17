using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;

internal sealed class ProgressReadException(string message) : Exception(message);

internal sealed class ProgressReader
{
    private const int MaxSaveSize = 64 * 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly SemaphoreSlim _readGate = new(1);
    private readonly GameSettings _gameSettings = new();
    private readonly Catalog _catalog;
    private readonly string _savePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        "AppData", "LocalLow", "nspgames", "dungeonslasher", "DGSave.es3");

    internal ProgressReader()
    {
        using Stream stream = Program.OpenResource("catalog.json");
        _catalog = JsonSerializer.Deserialize<Catalog>(stream, JsonOptions)
            ?? throw new InvalidDataException("내장 도감 데이터를 읽을 수 없어요.");
    }

    internal async Task<ProgressSnapshot> ReadAsync(CancellationToken cancellationToken)
    {
        await _readGate.WaitAsync(cancellationToken);
        try
        {
            for (int attempt = 0; ; attempt++)
            {
                try
                {
                    return ReadOnce();
                }
                catch (FileNotFoundException)
                {
                    throw new ProgressReadException("로컬 세이브를 찾을 수 없어요. 게임에서 세이브가 생성된 뒤 새로고침해 주세요.");
                }
                catch (DirectoryNotFoundException)
                {
                    throw new ProgressReadException("로컬 세이브를 찾을 수 없어요. 게임에서 세이브가 생성된 뒤 새로고침해 주세요.");
                }
                catch (UnauthorizedAccessException)
                {
                    throw new ProgressReadException("로컬 세이브를 읽을 권한을 확인해 주세요.");
                }
                catch (Exception ex) when (ex is IOException or InvalidDataException or CryptographicException or JsonException)
                {
                    if (attempt == 2)
                        throw new ProgressReadException("세이브를 읽을 수 없어요. 게임의 저장이 끝난 뒤 새로고침해 주세요.");
                    await Task.Delay(100 * (attempt + 1), cancellationToken);
                }
            }
        }
        finally
        {
            _readGate.Release();
        }
    }

    private ProgressSnapshot ReadOnce()
    {
        using var stream = new FileStream(_savePath, FileMode.Open, FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete);
        DateTime savedAt = File.GetLastWriteTimeUtc(_savePath);
        long fileLength = stream.Length;
        if (fileLength <= 0 || fileLength > MaxSaveSize)
            throw new InvalidDataException("Unexpected save size");
        var bytes = new byte[(int)fileLength];
        stream.ReadExactly(bytes);
        if (stream.Length != fileLength || File.GetLastWriteTimeUtc(_savePath) != savedAt)
            throw new IOException("Save changed during read");

        byte[] json = bytes;
        try
        {
            if (!LooksLikeJson(json) && !IsGzip(json))
                json = Decrypt(json, _gameSettings.GetPassword());
            if (IsGzip(json))
            {
                byte[] compressed = json;
                try { json = Decompress(compressed); }
                finally { if (!ReferenceEquals(compressed, bytes)) CryptographicOperations.ZeroMemory(compressed); }
            }
            ReadOnlyMemory<byte> text = json;
            if (text.Span.StartsWith(new byte[] { 0xef, 0xbb, 0xbf })) text = text[3..];
            using JsonDocument document = JsonDocument.Parse(text);
            JsonElement save = document.RootElement;
            var skillIds = ReadUnlocked(save, "UnlockSkills");
            var artifacts = ReadUnlocked(save, "UnlockArtifacts");
            var curses = ReadCurses(save);
            return new ProgressSnapshot(_catalog.Version, savedAt,
                _catalog.Skills.Select(item => Describe(item, skillIds.Contains(item.Id))).ToArray(),
                _catalog.Artifacts.Select(item => Describe(item, item.Kind == "curse"
                    ? curses.Contains(item.Id) : artifacts.Contains(item.Id))).ToArray());
        }
        finally
        {
            CryptographicOperations.ZeroMemory(json);
            if (!ReferenceEquals(json, bytes)) CryptographicOperations.ZeroMemory(bytes);
        }
    }

    private static HashSet<int> ReadUnlocked(JsonElement save, string key)
    {
        if (save.ValueKind != JsonValueKind.Object || !save.TryGetProperty(key, out var wrapper)
            || wrapper.ValueKind != JsonValueKind.Object || !wrapper.TryGetProperty("value", out var values)
            || values.ValueKind != JsonValueKind.Object)
            throw new ProgressReadException("이 세이브에서 도감 해금 기록을 찾을 수 없어요. 게임에서 먼저 세이브를 확인해 주세요.");
        var unlocked = new HashSet<int>();
        foreach (var item in values.EnumerateObject())
        {
            if (int.TryParse(item.Name, NumberStyles.None, CultureInfo.InvariantCulture, out int id)
                && item.Value.ValueKind == JsonValueKind.Number && item.Value.TryGetInt32(out int state) && state == 2)
                unlocked.Add(id);
        }
        return unlocked;
    }

    private static HashSet<int> ReadCurses(JsonElement save)
    {
        var seen = new HashSet<int>();
        if (save.TryGetProperty("CodexSeen", out var wrapper) && wrapper.ValueKind == JsonValueKind.Object
            && wrapper.TryGetProperty("value", out var value) && value.ValueKind == JsonValueKind.Object
            && value.TryGetProperty("Dungeon", out var dungeon) && dungeon.ValueKind == JsonValueKind.Object
            && dungeon.TryGetProperty("CurseArtifact", out var values)
            && values.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in values.EnumerateArray())
                if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out int id)) seen.Add(id);
        }
        return seen;
    }

    private static EntryView Describe(CatalogEntry item, bool unlocked)
    {
        string kindLabel = item.Kind switch { "curse" => "저주", "arena" => "투기장 전용", _ => "" };
        return new EntryView(item.Id, item.Name, item.Grade, item.Condition, item.Tags,
            item.Icon, kindLabel, item.DefaultUnlocked || unlocked);
    }

    private static bool LooksLikeJson(ReadOnlySpan<byte> data)
    {
        if (data.StartsWith(new byte[] { 0xef, 0xbb, 0xbf })) data = data[3..];
        foreach (byte value in data)
            if (value is not ((byte)' ' or (byte)'\t' or (byte)'\r' or (byte)'\n')) return value == (byte)'{';
        return false;
    }

    private static bool IsGzip(ReadOnlySpan<byte> data) => data.Length >= 2 && data[0] == 0x1f && data[1] == 0x8b;

    private static byte[] Decrypt(ReadOnlySpan<byte> data, ReadOnlySpan<byte> password)
    {
        if (data.Length < 32 || data.Length % 16 != 0)
            throw new InvalidDataException("Incomplete encrypted save");
        ReadOnlySpan<byte> iv = data[..16];
        byte[] key = Rfc2898DeriveBytes.Pbkdf2(password, iv, 100, HashAlgorithmName.SHA1, 16);
        try
        {
            using Aes aes = Aes.Create();
            aes.Key = key;
            return aes.DecryptCbc(data[16..], iv, PaddingMode.PKCS7);
        }
        finally { CryptographicOperations.ZeroMemory(key); }
    }

    private static byte[] Decompress(byte[] data)
    {
        using var gzip = new GZipStream(new MemoryStream(data), CompressionMode.Decompress);
        using var output = new MemoryStream();
        var buffer = new byte[16384];
        for (int read; (read = gzip.Read(buffer)) > 0;)
        {
            if (output.Length + read > MaxSaveSize) throw new InvalidDataException("Unexpected decompressed save size");
            output.Write(buffer, 0, read);
        }
        return output.ToArray();
    }
}

internal sealed record Catalog(string Version, CatalogEntry[] Skills, CatalogEntry[] Artifacts);
internal sealed record CatalogEntry(int Id, string Kind, string Name, string Grade, string Condition,
    string Tags, int Icon, bool DefaultUnlocked);
internal sealed record EntryView(int Id, string Name, string Grade, string Condition, string Tags,
    int Icon, string KindLabel, bool Unlocked);
internal sealed record ProgressSnapshot(string CatalogVersion, DateTime SaveTime, EntryView[] Skills, EntryView[] Artifacts);
