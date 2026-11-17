using System.Diagnostics;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

internal static partial class Program
{
    private const string Title = "던전슬래셔 해금 현황";

    public static async Task Main(string[] args)
    {
        bool headless = args.Contains("--headless", StringComparer.Ordinal);
        try
        {
            await LaunchAsync(headless);
        }
        catch (Exception ex)
        {
            string message = "해금 현황을 열 수 없어요. " + ex.Message;
            if (headless) Console.Error.WriteLine(message);
            else MessageBox(IntPtr.Zero, message, Title, 0x10);
            Environment.ExitCode = 1;
        }
    }

    private static async Task LaunchAsync(bool headless)
    {
        string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "DungeonSlasherUnlockTracker");
        Directory.CreateDirectory(directory);
        string session = Path.Combine(directory, "launcher.session");
        using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false })
        {
            Timeout = TimeSpan.FromMilliseconds(500),
        };

        for (int attempt = 0; attempt < 25; attempt++)
        {
            FileStream lease;
            try
            {
                lease = new FileStream(session, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.Read);
            }
            catch (IOException error) when ((error.HResult & 0xffff) is 32 or 33)
            {
                Uri? address = await RunningAddressAsync(session, client);
                if (address is not null)
                {
                    OpenDashboard(address.AbsoluteUri, headless);
                    return;
                }
                await Task.Delay(150);
                continue;
            }

            using (lease)
            {
                lease.SetLength(0);
                try { await ServeAsync(headless, lease, new FavoritesStore(Path.Combine(directory, "favorites.json"))); }
                finally { lease.SetLength(0); }
            }
            return;
        }
        throw new InvalidOperationException("실행 중인 대시보드에 연결할 수 없어요. 잠시 뒤 다시 열어 주세요.");
    }

    private static async Task<Uri?> RunningAddressAsync(string session, HttpClient client)
    {
        try
        {
            using var stream = new FileStream(session, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            if (stream.Length is <= 0 or > 128) return null;
            using var reader = new StreamReader(stream);
            string value = await reader.ReadToEndAsync();
            if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? address)
                || address.Scheme != Uri.UriSchemeHttp || address.Host != "127.0.0.1" || address.IsDefaultPort
                || address.UserInfo.Length != 0 || address.Query.Length != 0 || address.Fragment.Length != 0)
                return null;
            string path = address.AbsolutePath;
            if (path.Length != 34 || path[^1] != '/' || !path[1..^1].All(Uri.IsHexDigit)) return null;
            using HttpResponseMessage response = await client.GetAsync(new Uri(address, "ping"));
            return response.StatusCode == HttpStatusCode.NoContent ? address : null;
        }
        catch (Exception error) when (error is IOException or HttpRequestException or OperationCanceledException)
        {
            return null;
        }
    }

    private static void OpenDashboard(string address, bool headless)
    {
        if (headless) Console.WriteLine(address);
        else Process.Start(new ProcessStartInfo(address) { UseShellExecute = true });
    }

    private static async Task ServeAsync(bool headless, FileStream lease, FavoritesStore favorites)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            Args = [],
            ContentRootPath = AppContext.BaseDirectory,
        });
        builder.Logging.ClearProviders();
        builder.Services.Configure<HostOptions>(options => options.ShutdownTimeout = TimeSpan.FromSeconds(5));
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.Listen(IPAddress.Loopback, 0);
            options.AddServerHeader = false;
            options.Limits.MaxRequestBodySize = 1024;
        });
        await using var app = builder.Build();
        var reader = new ProgressReader();
        string route = "/" + RandomNumberGenerator.GetHexString(32).ToLowerInvariant() + "/";
        long lastSeen = Environment.TickCount64;

        app.Use(async (context, next) =>
        {
            if (context.Request.Host.Host != "127.0.0.1")
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers["Content-Security-Policy"] =
                "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
                "img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (context.Request.Path.Value?.StartsWith(route, StringComparison.Ordinal) == true)
                Interlocked.Exchange(ref lastSeen, Environment.TickCount64);
            await next(context);
        });
        app.MapGet(route, () => Resource("index.html", "text/html; charset=utf-8"));
        app.MapGet(route + "dashboard.css", () => Resource("dashboard.css", "text/css; charset=utf-8"));
        app.MapGet(route + "dashboard.js", () => Resource("dashboard.js", "text/javascript; charset=utf-8"));
        app.MapGet(route + "recommendations.js", () => Resource("recommendations.js", "text/javascript; charset=utf-8"));
        app.MapGet(route + "unlock-routes.js", () => Resource("unlock-routes.js", "text/javascript; charset=utf-8"));
        app.MapGet(route + "unlock-loadouts.js", () => Resource("unlock-loadouts.js", "text/javascript; charset=utf-8"));
        app.MapGet(route + "loadouts.js", () => Resource("loadouts.js", "text/javascript; charset=utf-8"));
        app.MapGet(route + "icons.png", () => Resource("icons.png", "image/png"));
        app.MapGet(route + "ping", () => Results.NoContent());
        app.MapGet(route + "favorites", () =>
            FavoritesResponse(favorites.Read, "즐겨찾기를 불러오지 못했어요."));
        app.MapPost(route + "favorites", (FavoriteChange change) =>
        {
            if (change.Key is not { } key || !FavoritesStore.IsEntryKey(key) || change.Favorite is not bool favorite)
                return Results.BadRequest(new { error = "즐겨찾기 항목을 확인해 주세요." });
            return FavoritesResponse(() => favorites.Set(key, favorite), "즐겨찾기를 저장하지 못했어요.");
        });
        app.MapGet(route + "progress", async (HttpContext context) =>
        {
            try
            {
                return Results.Json(await reader.ReadAsync(context.RequestAborted));
            }
            catch (ProgressReadException ex)
            {
                return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        });
        app.MapPost(route + "stop", (HttpContext context) =>
        {
            context.Response.OnCompleted(() =>
            {
                app.Lifetime.StopApplication();
                return Task.CompletedTask;
            });
            return Results.NoContent();
        });

        await app.StartAsync();
        var server = app.Services.GetRequiredService<IServer>();
        string address = server.Features.Get<IServerAddressesFeature>()!.Addresses.Single() + route;
        await lease.WriteAsync(Encoding.UTF8.GetBytes(address));
        await lease.FlushAsync();
        OpenDashboard(address, headless);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        try
        {
            while (await timer.WaitForNextTickAsync(app.Lifetime.ApplicationStopping))
            {
                if (Environment.TickCount64 - Interlocked.Read(ref lastSeen) < TimeSpan.FromMinutes(20).TotalMilliseconds)
                    continue;
                app.Lifetime.StopApplication();
                break;
            }
        }
        catch (OperationCanceledException) when (app.Lifetime.ApplicationStopping.IsCancellationRequested) {}
        await app.StopAsync();
    }

    private static IResult FavoritesResponse(Func<string[]> read, string message)
    {
        try
        {
            return Results.Json(read());
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException)
        {
            return Results.Json(new { error = message }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    internal static Stream OpenResource(string name) =>
        Assembly.GetExecutingAssembly().GetManifestResourceStream(name)
        ?? throw new InvalidDataException("앱의 내장 데이터가 빠져 있습니다.");

    private static IResult Resource(string name, string contentType) => Results.Stream(OpenResource(name), contentType);

    [LibraryImport("user32.dll", EntryPoint = "MessageBoxW", StringMarshalling = StringMarshalling.Utf16)]
    private static partial int MessageBox(IntPtr window, string text, string caption, uint flags);
}
