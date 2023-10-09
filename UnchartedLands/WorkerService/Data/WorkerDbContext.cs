using Microsoft.EntityFrameworkCore;

namespace WorkerService.Data
{
    public class WorkerDbContext : DbContext
    {
        protected readonly IConfiguration Configuration;

        public DbSet<Account> Accounts { get; private set; }

        public WorkerDbContext(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Account>().ToTable(nameof(Account));

            base.OnModelCreating(modelBuilder);
        }
        protected override void OnConfiguring(DbContextOptionsBuilder options)
        {
            options.UseNpgsql(Configuration.GetConnectionString("Database"));
        }
    }
}
