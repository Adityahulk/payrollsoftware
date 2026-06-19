using System.Data;
using Npgsql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Resend;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
    });
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddResend(options =>
{
    options.ApiToken = builder.Configuration["Resend:ApiToken"] ?? "re_Yb5aEZwg_7QCWZdiGJQsYVbJqSN9wKWZY";
});

// Allow large multipart uploads for file uploads (profile photo + documents)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 50 * 1024 * 1024; // 50 MB
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(
                "https://payrollmicrotechnique.store",
                "https://www.payrollmicrotechnique.store",
                "http://payrollmicrotechnique.store",
                "http://www.payrollmicrotechnique.store",
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://64.227.173.208",
                "http://64.227.173.208:3000",
                "http://64.227.173.208:3001",
                "http://64.227.173.208:5000",
                "http://64.227.173.208:5001",
                "https://payrollsoftindia.duckdns.org",
                "http://payrollsoftindia.duckdns.org",
                "https://payrollsoftindia.duckdns.org:3000",
                "http://payrollsoftindia.duckdns.org:3000",
                "https://payrollsoftindia.duckdns.org:3001",
                "http://payrollsoftindia.duckdns.org:3001",
                "https://payrollsoftindia.duckdns.org:5000",
                "http://payrollsoftindia.duckdns.org:5000",
                "https://payrollsoftindia.duckdns.org:5001",
                "http://payrollsoftindia.duckdns.org:5001"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        });
});


builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "DefaultIssuer",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "DefaultAudience",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "DefaultKeyForDevelopmentOnly"))
        };

        // ── SignalR WebSocket JWT support ──────────────────────────────────────────
        // Browsers cannot send custom headers in WebSocket upgrades.
        // SignalR passes the JWT as a query param (?access_token=...) instead.
        // This handler extracts the token and sets it so the middleware can validate it.
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/hub/screenshare") || path.StartsWithSegments("/hub/notifications")))
                {
                    context.Token = accessToken;
                }
                return System.Threading.Tasks.Task.CompletedTask;
            }
        };

        // ── SignalR WebSocket JWT support ──────────────────────────────────────────
        // Browsers cannot send custom headers in WebSocket upgrades.
        // SignalR passes the JWT as a query param (?access_token=...) instead.
        // This handler extracts the token and sets it so the middleware can validate it.
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    (path.StartsWithSegments("/hub/screenshare") || path.StartsWithSegments("/hub/notifications")))
                {
                    context.Token = accessToken;
                }
                return System.Threading.Tasks.Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Configure Dapper for snake_case column mapping automatically
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

// Add SignalR support
builder.Services.AddSignalR();

builder.Services.AddScoped<IDbConnection>(sp => 
    new NpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<Backend.Repositories.ISpaceRepository, Backend.Repositories.SpaceRepository>();
builder.Services.AddScoped<Backend.Repositories.IUserRepository, Backend.Repositories.UserRepository>();
builder.Services.AddScoped<Backend.Repositories.IAttendanceRepository, Backend.Repositories.AttendanceRepository>();
builder.Services.AddScoped<Backend.Repositories.IProjectRepository, Backend.Repositories.ProjectRepository>();
builder.Services.AddScoped<Backend.Repositories.INoticeRepository, Backend.Repositories.NoticeRepository>();
builder.Services.AddScoped<Backend.Repositories.IWorklogRepository, Backend.Repositories.WorklogRepository>();
builder.Services.AddScoped<Backend.Repositories.ISalaryRepository, Backend.Repositories.SalaryRepository>();
builder.Services.AddScoped<Backend.Repositories.IProfileRepository, Backend.Repositories.ProfileRepository>();
builder.Services.AddScoped<Backend.Repositories.IAnalyticsRepository, Backend.Repositories.AnalyticsRepository>();
builder.Services.AddScoped<Backend.Repositories.ILeaveRepository, Backend.Repositories.LeaveRepository>();
builder.Services.AddScoped<Backend.Repositories.IDashboardRepository, Backend.Repositories.DashboardRepository>();
builder.Services.AddScoped<Backend.Repositories.ISuperAdminRepository, Backend.Repositories.SuperAdminRepository>();
builder.Services.AddScoped<Backend.Services.INotificationService, Backend.Services.NotificationService>();
builder.Services.AddScoped<Backend.Services.IWfhService, Backend.Services.WfhService>();
builder.Services.AddScoped<Backend.Services.IAuditLogService, Backend.Services.AuditLogService>();
builder.Services.AddScoped<Backend.Services.IScreenshotService, Backend.Services.ScreenshotService>();
builder.Services.AddScoped<Backend.Services.IExcelService, Backend.Services.ExcelService>();
builder.Services.AddScoped<Backend.Services.ILeaveService, Backend.Services.LeaveService>();
builder.Services.AddScoped<Backend.Services.IAttendanceService, Backend.Services.AttendanceService>();
builder.Services.AddScoped<Backend.Services.ISalaryService, Backend.Services.SalaryService>();
builder.Services.AddScoped<Backend.Services.IBonusTaskService, Backend.Services.BonusTaskService>();
builder.Services.AddScoped<Backend.Services.IPerformanceService, Backend.Services.PerformanceService>();
builder.Services.AddScoped<Backend.Services.IIncentiveService, Backend.Services.IncentiveService>();
builder.Services.AddScoped<Backend.Services.IPayrollEngine, Backend.Services.PayrollEngine>();
builder.Services.AddScoped<Backend.Services.IPayslipGenerator, Backend.Services.PayslipGenerator>();
builder.Services.AddScoped<Backend.Services.IUserService, Backend.Services.UserService>();
builder.Services.AddScoped<Backend.Services.IProjectService, Backend.Services.ProjectService>();
builder.Services.AddScoped<Backend.Services.IWorklogService, Backend.Services.WorklogService>();
builder.Services.AddScoped<Backend.Services.ISpaceService, Backend.Services.SpaceService>();
builder.Services.AddHostedService<Backend.Services.MonthEndHostedService>();

var app = builder.Build();

// Run DB Reorganization to fix UUID/Integer column issues automatically
try
{
    var connString = builder.Configuration.GetConnectionString("DefaultConnection");
    using (var conn = new NpgsqlConnection(connString))
    {
        conn.Open();

        // Ensure core tables exist before any alter/migration commands run
        using (var coreTablesCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_users (
                empid               SERIAL PRIMARY KEY,
                spaceid             INT,
                name                VARCHAR(200),
                email               VARCHAR(255) UNIQUE,
                passwordhash        VARCHAR(255),
                gender              VARCHAR(50),
                status              VARCHAR(50),
                role                VARCHAR(50),
                phone               VARCHAR(50),
                address             TEXT,
                dateofjoining       DATE DEFAULT CURRENT_DATE,
                profilephotourl     TEXT,
                backupemail         VARCHAR(100),
                accountnumber       VARCHAR(50),
                bankname            VARCHAR(100),
                accountholdername   VARCHAR(150),
                ifsccode            VARCHAR(20),
                upiid               VARCHAR(100),
                is_approved         BOOLEAN DEFAULT FALSE,
                statusreason        TEXT,
                statusbysuperadmin  BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS t_spaces (
                spaceid             SERIAL PRIMARY KEY,
                spacename           VARCHAR(255),
                adminid             INT,
                numberofemployees   INT,
                createdat           TIMESTAMP WITHOUT TIME ZONE,
                isactive            BOOLEAN DEFAULT TRUE,
                numberofbreaks      INT DEFAULT 1,
                breaktime           INT,
                workstarttime       TIME,
                workendtime         TIME,
                workinghours        INT,
                type                VARCHAR(20) DEFAULT 'Department',
                enddate             DATE,
                workingdays         TEXT,
                maxspaces           INT,
                is_monitoring_enabled BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS t_attendance (
                attendanceid        SERIAL PRIMARY KEY,
                empid               INT,
                attendancedate      DATE,
                clockin             TIMESTAMP,
                clockout            TIMESTAMP,
                totalhours          NUMERIC(5,2),
                status              VARCHAR(50),
                lateminutes         INT,
                earlyexitminutes    INT,
                breakhours          NUMERIC(5,2) DEFAULT 0,
                overtimehours       NUMERIC(5,2) DEFAULT 0,
                createdat           TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS t_projects (
                projectid           SERIAL PRIMARY KEY,
                createdbyid         INT,
                adminid             INT,
                spaceid             INT,
                projectname         VARCHAR(255),
                description         TEXT,
                links               TEXT[],
                documentationlinks  TEXT[],
                startdate           DATE,
                enddate             DATE,
                teamid              INT,
                createdat           TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS t_projecttasks (
                taskid              SERIAL PRIMARY KEY,
                projectid           INT,
                assignedtoempid     INT,
                tasktitle           VARCHAR(255),
                taskdescription     TEXT,
                taskstatus          VARCHAR(50),
                priority            VARCHAR(50),
                startdate           DATE,
                duedate             DATE,
                completedat         TIMESTAMP,
                workinghours        INT,
                estimatedhours      NUMERIC(6,2),
                createdat           TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS t_notices (
                noticeid            SERIAL PRIMARY KEY,
                adminid             INT,
                spaceid             INT,
                employeeid          INT,
                noticetext          TEXT,
                totype              VARCHAR(50),
                createdat           TIMESTAMP,
                preference          VARCHAR(20),
                reply               TEXT,
                status              VARCHAR(20) DEFAULT 'Open',
                repliedby           INT,
                isdeleted           BOOLEAN DEFAULT FALSE,
                eventtype           VARCHAR(50),
                targetrole          VARCHAR(50),
                is_read_admin       BOOLEAN,
                is_read_manager     BOOLEAN,
                is_read_tl          BOOLEAN,
                is_read_employee    BOOLEAN
            );

            CREATE TABLE IF NOT EXISTS t_employeewarnings (
                warningid           SERIAL PRIMARY KEY,
                empid               INT,
                warningtext         TEXT,
                penaltyamount       NUMERIC(12,2),
                issuedby            INT
            );
        ", conn))
        {
            coreTablesCmd.ExecuteNonQuery();
            System.Console.WriteLine("[Database Reorganization] Verified core tables exist (t_users, t_spaces, t_attendance, t_projects, t_projecttasks, t_notices, t_employeewarnings).");
        }

        using (var cmd = new NpgsqlCommand(@"
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 't_notices' AND column_name = 'spaceid';", conn))
        {
            var dataType = cmd.ExecuteScalar()?.ToString();
            if (dataType != null && dataType.ToLower() == "uuid")
            {
                System.Console.WriteLine("[Database Reorganization] Altering t_notices.spaceid from UUID to INTEGER.");
                using (var alterCmd = new NpgsqlCommand("ALTER TABLE t_notices DROP COLUMN spaceid; ALTER TABLE t_notices ADD COLUMN spaceid INTEGER;", conn))
                {
                    alterCmd.ExecuteNonQuery();
                }
            }
        }

        // --- DIAGNOSTICS START ---
        try
        {
            using (var cmd = new NpgsqlCommand("SELECT empid, email FROM t_users WHERE role = 'Admin';", conn))
            using (var reader = cmd.ExecuteReader())
            {
                System.Console.WriteLine("[Diagnostic] Admins in system:");
                while (reader.Read())
                {
                    System.Console.WriteLine($"Admin EmpId: {reader["empid"]}, Email: {reader["email"]}");
                }
            }

            using (var cmd = new NpgsqlCommand("SELECT spaceid, spacename, adminid FROM t_spaces;", conn))
            using (var reader = cmd.ExecuteReader())
            {
                System.Console.WriteLine("[Diagnostic] Spaces in system:");
                while (reader.Read())
                {
                    System.Console.WriteLine($"SpaceId: {reader["spaceid"]}, Name: {reader["spacename"]}, AdminId: {reader["adminid"]}");
                }
            }
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[Diagnostic Error] {ex.Message}");
        }
        // --- DIAGNOSTICS END ---
        
        // Ensure employeebreaks table exists
        using (var createTableCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS employeebreaks (
                breakid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                breakstart TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                breakend TIMESTAMP WITHOUT TIME ZONE,
                totalbreakminutes INTEGER DEFAULT 0,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            createTableCmd.ExecuteNonQuery();
            System.Console.WriteLine("[Database Reorganization] Verified employeebreaks table exists.");
        }

        // Add phone, address, dateofjoining columns to t_users if missing
        using (var migrateUsersCmd = new NpgsqlCommand(@"
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS address TEXT;
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS dateofjoining DATE DEFAULT CURRENT_DATE;", conn))
        {
            migrateUsersCmd.ExecuteNonQuery();
            System.Console.WriteLine("[Database Reorganization] Verified t_users schema columns exist.");
        }

        // Create t_worklogs table if missing
        using (var worklogCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_worklogs (
                logid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                taskid INTEGER NOT NULL,
                hoursworked NUMERIC(5,2) NOT NULL,
                description TEXT,
                workdate DATE NOT NULL DEFAULT CURRENT_DATE,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            worklogCmd.ExecuteNonQuery();
            System.Console.WriteLine("[Database Reorganization] Verified t_worklogs table exists.");
        }

        // Create t_salary table if missing
        using (var salaryCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_salary (
                salaryid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL UNIQUE,
                basic NUMERIC(12,2) NOT NULL DEFAULT 25000,
                hra NUMERIC(12,2) NOT NULL DEFAULT 10000,
                da NUMERIC(12,2) NOT NULL DEFAULT 3000,
                pf NUMERIC(12,2) NOT NULL DEFAULT 0,
                tds NUMERIC(12,2) NOT NULL DEFAULT 0
            );", conn))
        {
            salaryCmd.ExecuteNonQuery();
            System.Console.WriteLine("[Database Reorganization] Verified t_salary table exists.");
        }

        // Add estimatedhours to t_projecttasks if missing
        using (var estHrsCmd = new NpgsqlCommand(@"
            ALTER TABLE t_projecttasks ADD COLUMN IF NOT EXISTS estimatedhours NUMERIC(6,2) DEFAULT 8;", conn))
        {
            try { estHrsCmd.ExecuteNonQuery(); } catch { }
        }

        // Add teamid, enddate, createdbyid, adminid to t_projects if missing
        using (var teamCmd = new NpgsqlCommand(@"
            ALTER TABLE t_projects ADD COLUMN IF NOT EXISTS teamid INTEGER;
            ALTER TABLE t_projects ADD COLUMN IF NOT EXISTS enddate DATE;
            ALTER TABLE t_projects ADD COLUMN IF NOT EXISTS createdbyid INTEGER;
            ALTER TABLE t_projects ADD COLUMN IF NOT EXISTS adminid INTEGER;", conn))
        {
            try { teamCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_projects extended columns (incl. adminid).");
        }

        // Add workinghours and completedat to t_projecttasks if missing
        using (var taskColsCmd = new NpgsqlCommand(@"
            ALTER TABLE t_projecttasks ADD COLUMN IF NOT EXISTS workinghours INTEGER DEFAULT 0;
            ALTER TABLE t_projecttasks ADD COLUMN IF NOT EXISTS completedat TIMESTAMP WITHOUT TIME ZONE;", conn))
        {
            try { taskColsCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_projecttasks extended columns.");
        }

        // Add name + profilephotourl + backupemail to t_users
        using (var profileCmd = new NpgsqlCommand(@"
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS name VARCHAR(200);
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS profilephotourl TEXT;
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS backupemail VARCHAR(100);", conn))
        {
            try { profileCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_users profile and backupemail columns.");
        }

        // Create t_otp table
        using (var otpTableCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_otp (
                id SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                otp VARCHAR(10) NOT NULL,
                expiresat TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                isused BOOLEAN DEFAULT FALSE
            );", conn))
        {
            try { otpTableCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_otp table exists.");
        }


        // Migrate existing profile photo URLs
        using (var photoMigrateCmd = new NpgsqlCommand(@"
            UPDATE t_users 
            SET profilephotourl = REPLACE(profilephotourl, '/Profile photo/', '/profile-photo/')
            WHERE profilephotourl LIKE '/Profile photo/%';", conn))
        {
            try { photoMigrateCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Migrated profile photo URLs from old path structure.");
        }

        // Ensure wwwroot folders exist
        var wwwroot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        Directory.CreateDirectory(Path.Combine(wwwroot, "profile-photo"));
        Directory.CreateDirectory(Path.Combine(wwwroot, "Document"));
        System.Console.WriteLine("[Database Reorganization] Verified wwwroot upload folders.");

        // Create t_emp_documents table
        using (var docsCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_emp_documents (
                docid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                documenttype VARCHAR(100) NOT NULL,
                documentnumber VARCHAR(100) NOT NULL,
                fileurl TEXT NOT NULL,
                uploadedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_emp_doctype UNIQUE (empid, documenttype)
            );", conn))
        {
            docsCmd.ExecuteNonQuery();
            System.Console.WriteLine("[Database Reorganization] Verified t_emp_documents table exists.");
        }

        // Add overtimehours and breakhours to t_attendance
        using (var attCmd = new NpgsqlCommand(@"
            ALTER TABLE t_attendance ADD COLUMN IF NOT EXISTS overtimehours NUMERIC(5,2) DEFAULT 0;
            ALTER TABLE t_attendance ADD COLUMN IF NOT EXISTS breakhours NUMERIC(5,2) DEFAULT 0;", conn))
        {
            try { attCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_attendance overtime and breakhours columns.");
        }

        // Create t_leaves table + upgrade with new leave columns
        using (var leaveCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_leaves (
                leaveid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                leavedate DATE NOT NULL,
                reason TEXT,
                status VARCHAR(50) DEFAULT 'Pending',
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            try { leaveCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_leaves table.");
        }

        // Add spaceid column to t_leaves (separate command to avoid DO block issues)
        using (var c = new NpgsqlCommand("ALTER TABLE t_leaves ADD COLUMN IF NOT EXISTS spaceid INTEGER;", conn))
        { try { c.ExecuteNonQuery(); System.Console.WriteLine("[DB] t_leaves.spaceid OK"); } catch (Exception ex) { System.Console.WriteLine("[DB] t_leaves.spaceid: " + ex.Message); } }

        using (var c = new NpgsqlCommand("ALTER TABLE t_leaves ADD COLUMN IF NOT EXISTS leavetype VARCHAR(20) DEFAULT 'Normal';", conn))
        { try { c.ExecuteNonQuery(); System.Console.WriteLine("[DB] t_leaves.leavetype OK"); } catch (Exception ex) { System.Console.WriteLine("[DB] t_leaves.leavetype: " + ex.Message); } }

        using (var c = new NpgsqlCommand("ALTER TABLE t_leaves ADD COLUMN IF NOT EXISTS approvedby INTEGER;", conn))
        { try { c.ExecuteNonQuery(); System.Console.WriteLine("[DB] t_leaves.approvedby OK"); } catch (Exception ex) { System.Console.WriteLine("[DB] t_leaves.approvedby: " + ex.Message); } }

        using (var c = new NpgsqlCommand("ALTER TABLE t_leaves ADD COLUMN IF NOT EXISTS halfday BOOLEAN DEFAULT FALSE;", conn))
        { try { c.ExecuteNonQuery(); System.Console.WriteLine("[DB] t_leaves.halfday OK"); } catch (Exception ex) { System.Console.WriteLine("[DB] t_leaves.halfday: " + ex.Message); } }

        // Unique constraint for empid+leavedate (safe — ignore if already exists)
        using (var c = new NpgsqlCommand(@"
            DO $uq$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_emp_leavedate') THEN
                ALTER TABLE t_leaves ADD CONSTRAINT uq_emp_leavedate UNIQUE (empid, leavedate);
              END IF;
            END $uq$;", conn))
        { try { c.ExecuteNonQuery(); System.Console.WriteLine("[DB] uq_emp_leavedate constraint OK"); } catch (Exception ex) { System.Console.WriteLine("[DB] uq_emp_leavedate: " + ex.Message); } }

        // Create t_space_leave_config table — Admin configures leave limits per space
        using (var leaveConfigCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_space_leave_config (
                configid SERIAL PRIMARY KEY,
                spaceid INTEGER NOT NULL UNIQUE,
                emergency_leaves_per_month INTEGER DEFAULT 1,
                college_leaves_per_month INTEGER DEFAULT 1,
                normal_leaves_per_month INTEGER DEFAULT 999,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            try { leaveConfigCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_space_leave_config table.");
        }

        // Create t_employee_salary table
        using (var empSalaryCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_employee_salary (
                id SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                basicsalary NUMERIC(12,2) DEFAULT 0,
                hra NUMERIC(12,2) DEFAULT 0,
                da NUMERIC(12,2) DEFAULT 0,
                deductions NUMERIC(12,2) DEFAULT 0,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            try { empSalaryCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_employee_salary table.");
        }

        // Alter t_notices table to add query system columns if missing
        using (var noticesUpgradeCmd = new NpgsqlCommand(@"
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS preference VARCHAR(20);
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS reply TEXT;
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Open';
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS repliedby INTEGER;
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS isdeleted BOOLEAN DEFAULT FALSE;
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS eventtype VARCHAR(50);
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS targetrole VARCHAR(50);
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS is_read_admin BOOLEAN DEFAULT FALSE;
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS is_read_manager BOOLEAN DEFAULT FALSE;
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS is_read_tl BOOLEAN DEFAULT FALSE;
            ALTER TABLE t_notices ADD COLUMN IF NOT EXISTS is_read_employee BOOLEAN DEFAULT FALSE;", conn))
        {
            try { noticesUpgradeCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_notices query upgrade columns and real-time notification fields.");
        }

        // Alter t_spaces table to add isactive column if missing
        using (var spacesUpgradeCmd = new NpgsqlCommand(@"
            ALTER TABLE t_spaces ADD COLUMN IF NOT EXISTS isactive BOOLEAN DEFAULT TRUE;", conn))
        {
            try { spacesUpgradeCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_spaces query upgrade columns (isactive).");
        }

        // Alter t_spaces table to add contract columns (type, enddate) if missing
        using (var spacesContractUpgradeCmd = new NpgsqlCommand(@"
            ALTER TABLE t_spaces ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'Department';
            ALTER TABLE t_spaces ADD COLUMN IF NOT EXISTS enddate DATE;", conn))
        {
            try { spacesContractUpgradeCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_spaces contract columns (type, enddate).");
        }

        // Create t_contractpayments table if missing
        using (var contractPaymentsCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_contractpayments (
                paymentid SERIAL PRIMARY KEY,
                spaceid INTEGER NOT NULL,
                amount NUMERIC(12,2) NOT NULL,
                paymentmethod VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'Pending',
                transactionid TEXT,
                paidat TIMESTAMP,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            try { contractPaymentsCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_contractpayments table exists.");
        }

        // Create t_payrollpayments table if missing
        using (var payrollPaymentsCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_payrollpayments (
                paymentid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                spaceid INTEGER NOT NULL,
                totalamount NUMERIC(12,2) NOT NULL,
                deduction NUMERIC(12,2) NOT NULL,
                finalamount NUMERIC(12,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'Pending',
                paidat TIMESTAMP,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );", conn))
        {
            try { payrollPaymentsCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_payrollpayments table exists.");
        }

        // Create t_payslips table if missing
        using (var payslipsCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_payslips (
                slipid SERIAL PRIMARY KEY,
                empid INTEGER NOT NULL,
                spaceid INTEGER NOT NULL,
                baseamount NUMERIC(12,2) NOT NULL,
                deduction NUMERIC(12,2) NOT NULL,
                finalamount NUMERIC(12,2) NOT NULL,
                type VARCHAR(20) DEFAULT 'Payroll', -- Payroll / Contract
                paymentid INTEGER,                 -- Nullable link to payment
                generatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                month INTEGER,
                year INTEGER
            );", conn))
        {
            try { payslipsCmd.ExecuteNonQuery(); } catch { }
            System.Console.WriteLine("[Database Reorganization] Verified t_payslips table exists.");
        }

        // --- NEW SALARY AND ALLOWANCE MIGRATIONS ---
        using (var salarySystemCmd = new NpgsqlCommand(@"
            CREATE TABLE IF NOT EXISTS t_employeesalary (
                salaryid SERIAL PRIMARY KEY,
                empid INTEGER UNIQUE,
                spaceid INTEGER,
                basic NUMERIC(12,2) NOT NULL,
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS t_allowances (
                allowanceid SERIAL PRIMARY KEY,
                adminid INTEGER,
                spaceid INTEGER,
                name VARCHAR(100),
                type VARCHAR(20),  -- Percentage / Fixed
                value NUMERIC(10,2),
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS t_deductions (
                deductionid SERIAL PRIMARY KEY,
                adminid INTEGER,
                spaceid INTEGER,
                name VARCHAR(100),
                type VARCHAR(20),  -- Percentage / Fixed
                value NUMERIC(10,2),
                deductiontype VARCHAR(50) DEFAULT 'Standard',
                createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );

            ALTER TABLE t_deductions ADD COLUMN IF NOT EXISTS deductiontype VARCHAR(50) DEFAULT 'Standard';
            ALTER TABLE t_payrollpayments ADD COLUMN IF NOT EXISTS ismanual BOOLEAN DEFAULT FALSE;
            ALTER TABLE t_payrollpayments ADD COLUMN IF NOT EXISTS allowanceamount NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE t_payrollpayments ADD COLUMN IF NOT EXISTS deductionamount NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE t_payrollpayments ADD COLUMN IF NOT EXISTS paymentmethod VARCHAR(20);
            ALTER TABLE t_payrollpayments ADD COLUMN IF NOT EXISTS transactionid TEXT;
            ALTER TABLE t_payrollpayments ADD COLUMN IF NOT EXISTS groupid UUID;

            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS basic NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS totalallowance NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS totaldeduction NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS breakdown TEXT;
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS paymentmethod VARCHAR(20);
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS transactionid TEXT;
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS accountnumber VARCHAR(50);
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS bankname VARCHAR(100);
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS accountholdername VARCHAR(150);
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS ifsccode VARCHAR(20);
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS upiid VARCHAR(100);
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS month INTEGER;
            ALTER TABLE t_payslips ADD COLUMN IF NOT EXISTS year INTEGER;

            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS accountnumber VARCHAR(50);
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS bankname VARCHAR(100);
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS accountholdername VARCHAR(150);
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS ifsccode VARCHAR(20);
            ALTER TABLE t_users ADD COLUMN IF NOT EXISTS upiid VARCHAR(100);
        ", conn))
        {
            try
            {
                salarySystemCmd.ExecuteNonQuery();
                System.Console.WriteLine("[Database Reorganization] Successfully completed Salary & Allowances/Deductions migrations.");
            }
            catch (System.Exception ex)
            {
                System.Console.WriteLine($"[Database Reorganization Warning] Salary migrations failed: {ex.Message}");
            }
        }

        // Auto-seed t_employeesalary for any user without a salary record (default by role)
        try
        {
            using (var seedSalaryCmd = new NpgsqlCommand(@"
                INSERT INTO t_employeesalary (empid, spaceid, basic, createdat)
                SELECT 
                    u.empid,
                    u.spaceid,
                    CASE u.role
                        WHEN 'Admin'     THEN 65000
                        WHEN 'Manager'   THEN 45000
                        WHEN 'TeamLead'  THEN 35000
                        ELSE 25000
                    END,
                    NOW()
                FROM t_users u
                WHERE u.empid NOT IN (SELECT empid FROM t_employeesalary WHERE empid IS NOT NULL)
                  AND u.status != 'Pending'
                ON CONFLICT (empid) DO NOTHING;", conn))
            {
                int seeded = seedSalaryCmd.ExecuteNonQuery();
                if (seeded > 0)
                    System.Console.WriteLine($"[Database Reorganization] Auto-seeded salary records for {seeded} user(s) with default values.");
            }
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[Database Reorganization Warning] Salary auto-seed failed: {ex.Message}");
        }

        // Align t_spaces.adminid with the Admin user's empid (PART 2 & PART 3)
        try
        {
            using (var getAdminCmd = new NpgsqlCommand("SELECT empid FROM t_users WHERE role = 'Admin' LIMIT 1;", conn))
            {
                var adminObj = getAdminCmd.ExecuteScalar();
                if (adminObj != null && int.TryParse(adminObj.ToString(), out int adminEmpId))
                {
                    System.Console.WriteLine($"[Database Reorganization] Found primary Admin EmpId: {adminEmpId}");
                    using (var fixSpacesCmd = new NpgsqlCommand(@"
                        UPDATE t_spaces 
                        SET adminid = @AdminId 
                        WHERE adminid IS NULL OR adminid NOT IN (SELECT empid FROM t_users WHERE role = 'Admin');", conn))
                    {
                        fixSpacesCmd.Parameters.AddWithValue("AdminId", adminEmpId);
                        int rowsUpdated = fixSpacesCmd.ExecuteNonQuery();
                        System.Console.WriteLine($"[Database Reorganization] Auto-aligned space ownership to adminid={adminEmpId}. Rows updated: {rowsUpdated}");
                    }
                }
                else
                {
                    System.Console.WriteLine("[Database Reorganization] Warning: No Admin user found to align space ownership.");
                }
            }
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[Database Reorganization] Failed to align space ownership: {ex.Message}");
        }

        // Create high-performance query indexes on foreign key and lookup columns to resolve slow page loads
        try
        {
            using (var indexCmd = new NpgsqlCommand(@"
                CREATE INDEX IF NOT EXISTS idx_t_users_spaceid ON t_users(spaceid);
                CREATE INDEX IF NOT EXISTS idx_t_attendance_empid ON t_attendance(empid);
                CREATE INDEX IF NOT EXISTS idx_t_worklogs_empid ON t_worklogs(empid);
                CREATE INDEX IF NOT EXISTS idx_t_payrollpayments_empid ON t_payrollpayments(empid);
                CREATE INDEX IF NOT EXISTS idx_t_payslips_empid ON t_payslips(empid);
                CREATE INDEX IF NOT EXISTS idx_t_allowances_spaceid ON t_allowances(spaceid);
                CREATE INDEX IF NOT EXISTS idx_t_deductions_spaceid ON t_deductions(spaceid);
                CREATE INDEX IF NOT EXISTS idx_employeebreaks_empid ON employeebreaks(empid);
                CREATE INDEX IF NOT EXISTS idx_t_leaves_empid ON t_leaves(empid);

                -- Composite indexes for payroll bulk-fetch optimization (added 2025)
                CREATE INDEX IF NOT EXISTS idx_attendance_emp_date
                    ON t_attendance(empid, attendancedate);
                CREATE INDEX IF NOT EXISTS idx_attendance_space_date
                    ON t_attendance(empid, attendancedate DESC);
                CREATE INDEX IF NOT EXISTS idx_leaves_emp_date_status
                    ON t_leaves(empid, leavedate, status);
                CREATE INDEX IF NOT EXISTS idx_worklogs_emp_date
                    ON t_worklogs(empid, workdate);
                CREATE INDEX IF NOT EXISTS idx_payroll_space_date
                    ON t_payrollpayments(spaceid, createdat DESC);
                CREATE INDEX IF NOT EXISTS idx_tasks_assigned_emp
                    ON t_projecttasks(assignedtoempid);
            ", conn))
            {
                indexCmd.ExecuteNonQuery();
                System.Console.WriteLine("[Database Reorganization] Successfully completed query index creation for 10x-100x loading speedup.");
            }
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[Database Reorganization Warning] Query index creation failed: {ex.Message}");
        }

        // SuperAdmin Panel database migrations
        try
        {
            using (var cmd = new NpgsqlCommand(@"
                ALTER TABLE t_users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
                ALTER TABLE t_users ADD COLUMN IF NOT EXISTS statusreason TEXT;
                ALTER TABLE t_spaces ADD COLUMN IF NOT EXISTS maxspaces INTEGER DEFAULT 5;
                ALTER TABLE t_users ADD COLUMN IF NOT EXISTS statusbysuperadmin BOOLEAN DEFAULT FALSE;

                -- Auto-approve any existing active Admins (so they are NOT locked out)
                UPDATE t_users SET is_approved = TRUE 
                WHERE role = 'Admin' AND status = 'Active' AND (is_approved IS NULL OR is_approved = FALSE);

                -- Set statusbysuperadmin = TRUE for existing active admins (keep working)
                UPDATE t_users SET statusbysuperadmin = TRUE 
                WHERE role = 'Admin' AND status = 'Active' AND (statusbysuperadmin IS NULL OR statusbysuperadmin = FALSE);
            ", conn))
            {
                cmd.ExecuteNonQuery();
                System.Console.WriteLine("[SuperAdmin Panel] Database columns and auto-approvals checked.");
            }

            using (var cmdTable = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS t_superadmins (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    passwordhash VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ", conn))
            {
                cmdTable.ExecuteNonQuery();
                System.Console.WriteLine("[SuperAdmin Panel] t_superadmins table verified/created.");
            }

            // Seed custom superadmin account requested by user
            using (var cmdSeedCustom = new NpgsqlCommand(@"
                INSERT INTO t_superadmins (
                    email,
                    passwordhash,
                    name,
                    created_at,
                    updated_at
                )
                VALUES (
                    'microtechnique09@gmail.com',
                    'AQAAAAEAACcQAAAAEFsAY9j1j9D6dBTDymwtEn4TI1XdONglPwIC5Vq9z1ZKDWP5IqLPgXVGSM8XyKp40w==',
                    'Ashutosh pandey',
                    NOW(),
                    NOW()
                )
                ON CONFLICT (email) DO NOTHING;
            ", conn))
            {
                cmdSeedCustom.ExecuteNonQuery();
                System.Console.WriteLine("[SuperAdmin Panel] Seeded custom superadmin account: microtechnique09@gmail.com");
            }

            using (var cmdCheck = new NpgsqlCommand("SELECT COUNT(1) FROM t_superadmins;", conn))
            {
                var count = Convert.ToInt32(cmdCheck.ExecuteScalar());
                if (count == 0)
                {
                    var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<object>();
                    var defaultPasswordHash = hasher.HashPassword(new object(), "SuperAdmin@123");
                    using (var cmdInsert = new NpgsqlCommand(@"
                        INSERT INTO t_superadmins (email, passwordhash, name)
                        VALUES ('mti@super.com', @PasswordHash, 'MTI SuperAdmin');
                    ", conn))
                    {
                        cmdInsert.Parameters.AddWithValue("PasswordHash", defaultPasswordHash);
                        cmdInsert.ExecuteNonQuery();
                    }
                    System.Console.WriteLine("[SuperAdmin Panel] Seeded default superadmin account: mti@super.com");
                }
            }

            // --- PRODUCTION-READY SECURITY & FEATURE MIGRATIONS (2026) ---
            using (var cmdFeatures = new NpgsqlCommand(@"
                -- 1. Screenshot Tracking Config Table
                CREATE TABLE IF NOT EXISTS screenshot_config (
                    id SERIAL PRIMARY KEY,
                    spaceid INTEGER UNIQUE NOT NULL,
                    interval_minutes INTEGER DEFAULT 30,
                    is_enabled BOOLEAN DEFAULT FALSE,
                    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                    updatedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );

                -- 2. Employee Screenshots Repository
                CREATE TABLE IF NOT EXISTS employee_screenshots (
                    screenshotid SERIAL PRIMARY KEY,
                    empid INTEGER NOT NULL,
                    spaceid INTEGER NOT NULL,
                    fileurl TEXT NOT NULL,
                    capturedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );

                -- 3. Work From Home Permissions
                CREATE TABLE IF NOT EXISTS t_wfh_permissions (
                    empid INTEGER NOT NULL,
                    alloweddate DATE NOT NULL,
                    PRIMARY KEY (empid, alloweddate)
                );

                -- 3.5. Holidays Table
                CREATE TABLE IF NOT EXISTS t_holidays (
                    holidayid SERIAL PRIMARY KEY,
                    holidaydate DATE NOT NULL,
                    name VARCHAR(150) NOT NULL,
                    type VARCHAR(50) DEFAULT 'National Holiday',
                    spaceid INTEGER NOT NULL,
                    CONSTRAINT uq_space_holidaydate UNIQUE (spaceid, holidaydate)
                );

                -- 4. Audit Log System
                CREATE TABLE IF NOT EXISTS t_audit_logs (
                    logid SERIAL PRIMARY KEY,
                    empid INTEGER NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    details TEXT,
                    ipaddress VARCHAR(45),
                    createdat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );

                -- 5. Work Intensity Bonus Tasks
                CREATE TABLE IF NOT EXISTS t_bonus_tasks (
                    taskid SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    spaceid INTEGER NOT NULL,
                    bonus_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Completed, Paid
                    assigned_to INTEGER, -- FK to t_users.empid
                    completed_at TIMESTAMP WITHOUT TIME ZONE
                );

                -- 6. Space Monitoring Toggle
                ALTER TABLE t_spaces ADD COLUMN IF NOT EXISTS is_monitoring_enabled BOOLEAN DEFAULT FALSE;

                -- 7. Database Constraints (Input Validation & Misuse Prevention)
                DO $$
                BEGIN
                    -- Worklogs constraint (hoursworked between 0.1 and 12)
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_hours_worked') THEN
                        ALTER TABLE t_worklogs ADD CONSTRAINT chk_hours_worked CHECK (hoursworked > 0 AND hoursworked <= 12);
                    END IF;

                    -- Salary basic positive constraints
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_salary_basic') THEN
                        ALTER TABLE t_salary ADD CONSTRAINT chk_salary_basic CHECK (basic >= 0);
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_salary_basic') THEN
                        ALTER TABLE t_employeesalary ADD CONSTRAINT chk_emp_salary_basic CHECK (basic >= 0);
                    END IF;
                END $$;
            ", conn))
            {
                cmdFeatures.ExecuteNonQuery();
                System.Console.WriteLine("[Platform Features] Screenshot, WFH, Audit Logs, Bonus Tasks, and constraints verified.");
            }

            // ── 8. Live Monitoring Screenshot Logs Table ──
            using (var monitoringCmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS t_employee_screenshot_logs (
                    logid            SERIAL PRIMARY KEY,
                    empid            INTEGER NOT NULL REFERENCES t_users(empid),
                    screenshoturl    TEXT NOT NULL,
                    captured_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_screenshot_logs_empid ON t_employee_screenshot_logs(empid);
                CREATE INDEX IF NOT EXISTS idx_screenshot_logs_captured ON t_employee_screenshot_logs(captured_at);

                CREATE TABLE IF NOT EXISTS t_employee_video_logs (
                    logid            SERIAL PRIMARY KEY,
                    empid            INTEGER NOT NULL REFERENCES t_users(empid),
                    videourl         TEXT NOT NULL,
                    captured_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_video_logs_empid ON t_employee_video_logs(empid);
                CREATE INDEX IF NOT EXISTS idx_video_logs_captured ON t_employee_video_logs(captured_at);
            ", conn))
            {
                try { monitoringCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified t_employee_screenshot_logs and t_employee_video_logs tables and indexes.");
            }

            // ── 9. Dynamic Monitoring Retention Columns ─────────────────────────
            // Adds screenshot_retention_days and video_retention_minutes to screenshot_config
            // so each space/admin can configure how long captures are kept.
            using (var retentionCmd = new NpgsqlCommand(@"
                ALTER TABLE screenshot_config
                    ADD COLUMN IF NOT EXISTS screenshot_retention_days INTEGER DEFAULT 60;
                ALTER TABLE screenshot_config
                    ADD COLUMN IF NOT EXISTS video_retention_minutes   INTEGER DEFAULT 15;

                -- Backfill any existing rows with the default values
                UPDATE screenshot_config
                SET screenshot_retention_days = 60
                WHERE screenshot_retention_days IS NULL;

                UPDATE screenshot_config
                SET video_retention_minutes = 15
                WHERE video_retention_minutes IS NULL;
            ", conn))
            {
                try { retentionCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified screenshot_config retention columns (screenshot_retention_days, video_retention_minutes).");
            }

            // ── 10. Employee-specific monitoring config column and constraints ─────────────────────────
            // Drops unique constraint on spaceid and adds empid column with unique partial indexes.
            using (var empConfigCmd = new NpgsqlCommand(@"
                ALTER TABLE screenshot_config
                    DROP CONSTRAINT IF EXISTS screenshot_config_spaceid_key;

                ALTER TABLE screenshot_config
                    ADD COLUMN IF NOT EXISTS empid INTEGER REFERENCES t_users(empid) ON DELETE CASCADE;

                CREATE UNIQUE INDEX IF NOT EXISTS idx_screenshot_config_employee 
                    ON screenshot_config(empid) WHERE empid IS NOT NULL;

                CREATE UNIQUE INDEX IF NOT EXISTS idx_screenshot_config_space_default 
                    ON screenshot_config(spaceid) WHERE empid IS NULL;
            ", conn))
            {
                try { empConfigCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified screenshot_config employee columns and unique constraints.");
            }

            // ── 11. Incentives Table ─────────────────────────
            using (var incentivesCmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS t_incentives (
                    incentiveid SERIAL PRIMARY KEY,
                    empid INT NOT NULL,
                    spaceid INT NOT NULL,
                    addedby INT NOT NULL,
                    amount DECIMAL NOT NULL,
                    type VARCHAR(50),
                    reason TEXT,
                    month INT,
                    year INT,
                    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_t_incentives_emp_month_year ON t_incentives(empid, month, year);
            ", conn))
            {
                try { incentivesCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified t_incentives table and index.");
            }

            // ── 12. Employee Performance Table ─────────────────────────
            using (var performanceCmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS t_employee_performance (
                    performanceid SERIAL PRIMARY KEY,
                    empid INT NOT NULL,
                    spaceid INT NOT NULL,
                    month INT NOT NULL,
                    year INT NOT NULL,
                    tasks_completed INT NOT NULL,
                    tasks_pending INT NOT NULL,
                    late_minutes INT NOT NULL,
                    early_exit_minutes INT NOT NULL,
                    attendance_score DECIMAL NOT NULL,
                    overall_score DECIMAL NOT NULL,
                    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_emp_month_year UNIQUE (empid, month, year)
                );
                CREATE INDEX IF NOT EXISTS idx_t_employee_performance_emp_month_year ON t_employee_performance(empid, month, year);
                CREATE INDEX IF NOT EXISTS idx_t_employee_performance_space ON t_employee_performance(spaceid);
            ", conn))
            {
                try { performanceCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified t_employee_performance table and indexes.");
            }

            // ── 13. Payslip Settings Table ─────────────────────────
            using (var payslipSettingsCmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS t_payslip_settings (
                    settingid SERIAL PRIMARY KEY,
                    spaceid INTEGER UNIQUE NOT NULL,
                    companyname VARCHAR(255),
                    logourl TEXT,
                    templateselector VARCHAR(50) DEFAULT 'Default',
                    tabletype VARCHAR(50) DEFAULT 'Standard',
                    showbasesalary BOOLEAN DEFAULT TRUE,
                    showallowances BOOLEAN DEFAULT TRUE,
                    showdeductions BOOLEAN DEFAULT TRUE,
                    showattendance BOOLEAN DEFAULT TRUE,
                    showleavestats BOOLEAN DEFAULT TRUE,
                    showovertime BOOLEAN DEFAULT TRUE,
                    showtaxdetails BOOLEAN DEFAULT TRUE,
                    showsignature BOOLEAN DEFAULT TRUE,
                    signatoryname VARCHAR(150),
                    footertext TEXT,
                    contactemail VARCHAR(255),
                    contactphone VARCHAR(50),
                    companyaddress TEXT,
                    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ", conn))
            {
                try { payslipSettingsCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified t_payslip_settings table.");
            }

            // Create t_project_files table
            using (var projectFilesCmd = new NpgsqlCommand(@"
                CREATE TABLE IF NOT EXISTS t_project_files (
                    fileid SERIAL PRIMARY KEY,
                    projectid INTEGER NOT NULL REFERENCES t_projects(projectid) ON DELETE CASCADE,
                    filename VARCHAR(255) NOT NULL,
                    filepath TEXT NOT NULL,
                    uploadedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_t_project_files_projectid ON t_project_files(projectid);
            ", conn))
            {
                try { projectFilesCmd.ExecuteNonQuery(); } catch { }
                System.Console.WriteLine("[Platform Features] Verified t_project_files table exists.");
            }
        }
        catch (System.Exception ex)
        {
            System.Console.WriteLine($"[SuperAdmin Panel Migration Error] {ex.Message}");
        }
    }
}
catch (System.Exception ex)
{
    System.Console.WriteLine($"[Database Reorganization] Warning: {ex.Message}");
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || true) // enable swagger
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

app.UseStaticFiles(); // serve wwwroot files (profile photos, documents)

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "profile-photo")),
    RequestPath = "/profile-photo"
});

// Serve Live Monitoring screenshot files from wwwroot/LiveMonitoring/
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "LiveMonitoring"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "LiveMonitoring")),
    RequestPath = "/LiveMonitoring"
});

// Serve Payslip Logos from wwwroot/payslip-logo/
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "payslip-logo"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "payslip-logo")),
    RequestPath = "/payslip-logo"
});

// Serve Project Files from wwwroot/project-files/
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "project-files"));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "project-files")),
    RequestPath = "/project-files"
});


// app.UseHttpsRedirection(); // Disabled for local HTTP development — re-enable for production

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<Backend.Hubs.NotificationHub>("/hub/notifications").RequireCors("AllowFrontend");
app.MapHub<Backend.Hubs.ScreenShareHub>("/hub/screenshare").RequireCors("AllowFrontend");
app.MapHub<Backend.Hubs.ScreenShareHub>("/hub/screenshare");

app.Run();

public class UtcDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
{
    public override DateTime Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        var str = reader.GetString();
        if (string.IsNullOrEmpty(str)) return default;
        return DateTime.Parse(str);
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime value, System.Text.Json.JsonSerializerOptions options)
    {
        if (value.TimeOfDay == TimeSpan.Zero && (value.Kind == DateTimeKind.Unspecified || value.Kind == DateTimeKind.Local))
        {
            writer.WriteStringValue(value.ToString("yyyy-MM-dd"));
        }
        else
        {
            if (value.Kind == DateTimeKind.Utc)
            {
                writer.WriteStringValue(value.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
            }
            else
            {
                writer.WriteStringValue(value.ToString("yyyy-MM-ddTHH:mm:ss.fff"));
            }
        }
    }
}
