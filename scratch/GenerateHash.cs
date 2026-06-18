// Quick hash generator — run with: dotnet script GenerateHash.csx
// OR paste into a .NET 8 console app

using Microsoft.AspNetCore.Identity;

var hasher = new PasswordHasher<object>();
var hash = hasher.HashPassword(new object(), "Ashu#1904");

Console.WriteLine("===========================================");
Console.WriteLine("Password : SuperAdmin@123");
Console.WriteLine("Hash     : " + hash);
Console.WriteLine("===========================================");
Console.WriteLine();
Console.WriteLine("SQL to insert:");
Console.WriteLine($"INSERT INTO t_superadmins (email, name, passwordhash)");
Console.WriteLine($"VALUES ('microtechnique09@gmail.com', 'MTI SuperAdmin', '{hash}');");
