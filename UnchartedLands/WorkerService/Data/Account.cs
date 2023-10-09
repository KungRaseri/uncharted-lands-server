using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WorkerService.Data
{
    public class Account
    {
        [Key]
        [Column("id")]
        public string Id { get; set; }
        public string email;
        public string passwordHash;
        public string userAuthToken;
        public string role;

        public DateTime createdAt;
        public DateTime updatedAt;
    }
}