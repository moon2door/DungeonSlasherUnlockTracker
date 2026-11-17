using System.Globalization;
using System.Text.Json;

internal sealed class FavoritesStore(string path)
{
    private readonly object _gate = new();

    internal static bool IsEntryKey(string? key) =>
        key is { Length: >= 2 and <= 11 } && key[0] is 's' or 'a' or 'c' or 'v'
        && int.TryParse(key.AsSpan(1), NumberStyles.None, CultureInfo.InvariantCulture, out _);

    internal string[] Read()
    {
        lock (_gate) return Load().Order(StringComparer.Ordinal).ToArray();
    }

    internal string[] Set(string key, bool favorite)
    {
        lock (_gate)
        {
            var keys = Load();
            bool changed = favorite ? keys.Add(key) : keys.Remove(key);
            var ordered = keys.Order(StringComparer.Ordinal).ToArray();
            if (changed)
            {
                // Replace the preferences file only after writing a complete copy.
                string temporary = path + ".tmp";
                File.WriteAllBytes(temporary, JsonSerializer.SerializeToUtf8Bytes(ordered));
                File.Move(temporary, path, overwrite: true);
            }
            return ordered;
        }
    }

    private HashSet<string> Load()
    {
        try
        {
            var keys = JsonSerializer.Deserialize<string[]>(File.ReadAllBytes(path));
            if (keys is null || keys.Any(key => !IsEntryKey(key)))
                throw new JsonException("Invalid favorites data");
            return new HashSet<string>(keys, StringComparer.Ordinal);
        }
        catch (FileNotFoundException)
        {
            return new HashSet<string>(StringComparer.Ordinal);
        }
    }
}

internal sealed record FavoriteChange(string? Key, bool? Favorite);
