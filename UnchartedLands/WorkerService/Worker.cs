using System.Data;
using System.Text.Json;
using Npgsql;
using WorkerService.Data;

namespace WorkerService
{
    public class Worker : BackgroundService
    {
        private const string ChannelName = "queue_notifier";
        private readonly ILogger<Worker> _logger;
        private readonly WorkerDbContext _db;

        public Worker(ILogger<Worker> logger, WorkerDbContext dbContext)
        {
            _logger = logger;
            _db = dbContext;
        }

        public override async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation(_db.Accounts.FirstOrDefault()?.Id);
            //await _connection.OpenAsync();

            //_connection.Notification += _connection_Notification;

            //using (var command = new NpgsqlCommand($"LISTEN {ChannelName}", _connection))
            //{
            //    _logger.LogInformation((command.ExecuteNonQuery()).ToString());
            //}

            await base.StartAsync(cancellationToken);
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            //await _connection.CloseAsync();

            await base.StopAsync(cancellationToken);
        }

        public class payload
        {
            public string Id { get; set; }
        }

        private void _connection_Notification(object sender, NpgsqlNotificationEventArgs e)
        {
            _logger.LogDebug("[NOTIFICATION] Notification Received");
            _logger.LogInformation(e.Channel);
            _logger.LogInformation(JsonSerializer.Deserialize<payload>(e.Payload)?.Id);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Worker running at: {time}", DateTimeOffset.Now);

                if (DateTime.UtcNow.Minute == 0 && DateTime.UtcNow.Second == 0)
                {
                    await ProcessHourlyTick();
                    _logger.LogInformation("hourly tick");
                }

                if (DateTime.UtcNow.Minute == 30 && DateTime.UtcNow.Second == 0)
                {
                    await ProcessHalfHourHourlyTick();
                    _logger.LogInformation("half hour, hourly tick");
                }

                await ProcessTick();

                //await _connection.WaitAsync(stoppingToken);

                await Task.Delay(1000, stoppingToken);
            }
        }

        private Task ProcessTick()
        {
            return Task.CompletedTask;
        }

        private Task ProcessHalfHourHourlyTick()
        {
            return Task.CompletedTask;
        }

        private Task ProcessHourlyTick()
        {
            return Task.CompletedTask;
        }
    }
}