using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WorkerService;
using WorkerService.Data;

Host.CreateDefaultBuilder(args)
    .ConfigureServices(services =>
    {
        services.AddHostedService<Worker>();

        services.AddDbContext<WorkerDbContext>(ServiceLifetime.Transient);
    })
    .Build()
    .Run();
