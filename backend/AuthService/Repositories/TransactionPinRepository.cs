using System.Text.Json;

namespace AuthService.Repositories;

public interface ITransactionPinRepository
{
    Task<bool> HasPinAsync(Guid userId);
    Task<bool> VerifyPinAsync(Guid userId, string pin);
    Task SetPinAsync(Guid userId, string pin);
    Task RemovePinAsync(Guid userId);
}

public class TransactionPinRepository : ITransactionPinRepository
{
    private readonly string _filePath;
    private readonly SemaphoreSlim _mutex = new(1, 1);

    public TransactionPinRepository(IWebHostEnvironment env)
    {
        var directory = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(directory);
        _filePath = Path.Combine(directory, "transaction-pins.json");
    }

    public async Task<bool> HasPinAsync(Guid userId)
    {
        var pins = await ReadPinsAsync();
        return pins.ContainsKey(userId.ToString());
    }

    public async Task<bool> VerifyPinAsync(Guid userId, string pin)
    {
        var pins = await ReadPinsAsync();
        return pins.TryGetValue(userId.ToString(), out var hash)
               && BCrypt.Net.BCrypt.Verify(pin, hash);
    }

    public async Task SetPinAsync(Guid userId, string pin)
    {
        await _mutex.WaitAsync();
        try
        {
            var pins = await ReadPinsUnsafeAsync();
            pins[userId.ToString()] = BCrypt.Net.BCrypt.HashPassword(pin);
            await WritePinsUnsafeAsync(pins);
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task RemovePinAsync(Guid userId)
    {
        await _mutex.WaitAsync();
        try
        {
            var pins = await ReadPinsUnsafeAsync();
            if (pins.Remove(userId.ToString()))
                await WritePinsUnsafeAsync(pins);
        }
        finally
        {
            _mutex.Release();
        }
    }

    private async Task<Dictionary<string, string>> ReadPinsAsync()
    {
        await _mutex.WaitAsync();
        try
        {
            return await ReadPinsUnsafeAsync();
        }
        finally
        {
            _mutex.Release();
        }
    }

    private async Task<Dictionary<string, string>> ReadPinsUnsafeAsync()
    {
        if (!File.Exists(_filePath))
            return new Dictionary<string, string>();

        var json = await File.ReadAllTextAsync(_filePath);
        if (string.IsNullOrWhiteSpace(json))
            return new Dictionary<string, string>();

        return JsonSerializer.Deserialize<Dictionary<string, string>>(json)
               ?? new Dictionary<string, string>();
    }

    private Task WritePinsUnsafeAsync(Dictionary<string, string> pins)
    {
        var json = JsonSerializer.Serialize(pins, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        return File.WriteAllTextAsync(_filePath, json);
    }
}
