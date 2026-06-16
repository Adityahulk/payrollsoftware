using Microsoft.AspNetCore.Identity;

var hasher = new PasswordHasher<object>();

string password = "Nehal@123";

var hash = hasher.HashPassword(new object(), password);

Console.WriteLine("===========================================");
Console.WriteLine($"Password : {password}");
Console.WriteLine($"Hash     : {hash}");
Console.WriteLine("===========================================");
Console.WriteLine();
Console.WriteLine("SQL INSERT:");
Console.WriteLine();
Console.WriteLine($"INSERT INTO t_superadmins (email, name, passwordhash)");
Console.WriteLine($"VALUES ('nehal36936@gmail.com', 'Nehal SuperAdmin', '{hash}');");
Console.WriteLine();
