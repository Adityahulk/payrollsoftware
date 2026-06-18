-- ============================================================
-- Microtechnique Payroll & HR Management Platform
-- Full Database Schema - init.sql
-- Auto-executed by PostgreSQL on first container startup
-- ============================================================

-- [1] t_users
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

-- [2] t_spaces
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
    maxspaces           INT
);

-- [3] t_attendance
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

-- [4] employeebreaks
CREATE TABLE IF NOT EXISTS employeebreaks (
    breakid             SERIAL PRIMARY KEY,
    empid               INT,
    breakstart          TIMESTAMP WITHOUT TIME ZONE,
    breakend            TIMESTAMP WITHOUT TIME ZONE,
    totalbreakminutes   INT DEFAULT 0,
    createdat           TIMESTAMP WITHOUT TIME ZONE
);

-- [5] t_leaves
CREATE TABLE IF NOT EXISTS t_leaves (
    leaveid             SERIAL PRIMARY KEY,
    empid               INT,
    spaceid             INT,
    leavedate           DATE,
    reason              TEXT,
    status              VARCHAR(50),
    leavetype           VARCHAR(20),
    halfday             BOOLEAN DEFAULT FALSE,
    approvedby          INT,
    createdat           TIMESTAMP,
    CONSTRAINT uq_emp_leavedate UNIQUE (empid, leavedate)
);

-- [6] t_space_leave_config
CREATE TABLE IF NOT EXISTS t_space_leave_config (
    configid                    SERIAL PRIMARY KEY,
    spaceid                     INT UNIQUE,
    emergency_leaves_per_month  INT DEFAULT 1,
    college_leaves_per_month    INT DEFAULT 1,
    normal_leaves_per_month     INT DEFAULT 999,
    createdat                   TIMESTAMP,
    updatedat                   TIMESTAMP
);

-- [7] t_worklogs
CREATE TABLE IF NOT EXISTS t_worklogs (
    logid               SERIAL PRIMARY KEY,
    empid               INT,
    taskid              INT,
    hoursworked         NUMERIC(5,2),
    description         TEXT,
    workdate            DATE,
    createdat           TIMESTAMP
);

-- [8] t_projects
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

-- [9] t_projecttasks
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

-- [10] t_employeesalary
CREATE TABLE IF NOT EXISTS t_employeesalary (
    salaryid            SERIAL PRIMARY KEY,
    empid               INT UNIQUE,
    spaceid             INT,
    basic               NUMERIC(12,2),
    createdat           TIMESTAMP
);

-- [11] t_allowances
CREATE TABLE IF NOT EXISTS t_allowances (
    allowanceid         SERIAL PRIMARY KEY,
    adminid             INT,
    spaceid             INT,
    name                VARCHAR(100),
    type                VARCHAR(20),
    value               NUMERIC(10,2),
    createdat           TIMESTAMP
);

-- [12] t_deductions
CREATE TABLE IF NOT EXISTS t_deductions (
    deductionid         SERIAL PRIMARY KEY,
    adminid             INT,
    spaceid             INT,
    name                VARCHAR(100),
    type                VARCHAR(20),
    value               NUMERIC(10,2),
    deductiontype       VARCHAR(50),
    createdat           TIMESTAMP
);

-- [13] t_payrollpayments
CREATE TABLE IF NOT EXISTS t_payrollpayments (
    paymentid           SERIAL PRIMARY KEY,
    empid               INT,
    spaceid             INT,
    totalamount         NUMERIC(12,2),
    deduction           NUMERIC(12,2),
    finalamount         NUMERIC(12,2),
    status              VARCHAR(20),
    paidat              TIMESTAMP,
    createdat           TIMESTAMP,
    ismanual            BOOLEAN DEFAULT FALSE,
    allowanceamount     NUMERIC(12,2),
    deductionamount     NUMERIC(12,2),
    paymentmethod       VARCHAR(20),
    transactionid       TEXT,
    groupid             UUID
);

-- [14] t_payslips
CREATE TABLE IF NOT EXISTS t_payslips (
    slipid              SERIAL PRIMARY KEY,
    empid               INT,
    spaceid             INT,
    baseamount          NUMERIC(12,2),
    deduction           NUMERIC(12,2),
    finalamount         NUMERIC(12,2),
    type                VARCHAR(20),
    paymentid           INT,
    generatedat         TIMESTAMP,
    month               INT,
    year                INT,
    basic               NUMERIC(12,2),
    totalallowance      NUMERIC(12,2),
    totaldeduction      NUMERIC(12,2),
    breakdown           TEXT,
    paymentmethod       VARCHAR(20),
    transactionid       TEXT,
    accountnumber       VARCHAR(50),
    bankname            VARCHAR(100),
    accountholdername   VARCHAR(150),
    ifsccode            VARCHAR(20),
    upiid               VARCHAR(100)
);

-- Add month/year columns to t_payslips if they don't exist (for existing deployments)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='t_payslips' AND column_name='month') THEN
        ALTER TABLE t_payslips ADD COLUMN month INT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='t_payslips' AND column_name='year') THEN
        ALTER TABLE t_payslips ADD COLUMN year INT;
    END IF;
END $$;

-- [15] t_contractpayments
CREATE TABLE IF NOT EXISTS t_contractpayments (
    paymentid           SERIAL PRIMARY KEY,
    spaceid             INT,
    amount              NUMERIC(12,2),
    paymentmethod       VARCHAR(20),
    status              VARCHAR(20),
    transactionid       TEXT,
    paidat              TIMESTAMP,
    createdat           TIMESTAMP
);

-- [16] t_otp
CREATE TABLE IF NOT EXISTS t_otp (
    id                  SERIAL PRIMARY KEY,
    empid               INT,
    otp                 VARCHAR(10),
    expiresat           TIMESTAMP,
    isused              BOOLEAN DEFAULT FALSE
);

-- [17] t_emp_documents
CREATE TABLE IF NOT EXISTS t_emp_documents (
    docid               SERIAL PRIMARY KEY,
    empid               INT,
    documenttype        VARCHAR(100),
    documentnumber      VARCHAR(100),
    fileurl             TEXT,
    uploadedat          TIMESTAMP,
    CONSTRAINT uq_emp_doctype UNIQUE (empid, documenttype)
);

-- [18] t_employeewarnings
CREATE TABLE IF NOT EXISTS t_employeewarnings (
    warningid           SERIAL PRIMARY KEY,
    empid               INT,
    warningtext         TEXT,
    penaltyamount       NUMERIC(12,2),
    issuedby            INT
);

-- [19] t_notices
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

-- [20] t_superadmins
CREATE TABLE IF NOT EXISTS t_superadmins (
    id                  SERIAL PRIMARY KEY,
    email               VARCHAR(255) UNIQUE,
    passwordhash        VARCHAR(255),
    name                VARCHAR(255),
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);

-- [21] t_employee_screenshot_logs (Live Monitoring)
CREATE TABLE IF NOT EXISTS t_employee_screenshot_logs (
    logid            SERIAL PRIMARY KEY,
    empid            INTEGER NOT NULL REFERENCES t_users(empid),
    screenshoturl    TEXT NOT NULL,
    captured_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screenshot_logs_empid ON t_employee_screenshot_logs(empid);
CREATE INDEX IF NOT EXISTS idx_screenshot_logs_captured ON t_employee_screenshot_logs(captured_at);

-- [22] t_employee_video_logs (Live Monitoring Recordings)
CREATE TABLE IF NOT EXISTS t_employee_video_logs (
    logid            SERIAL PRIMARY KEY,
    empid            INTEGER NOT NULL REFERENCES t_users(empid),
    videourl         TEXT NOT NULL,
    captured_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_logs_empid ON t_employee_video_logs(empid);
CREATE INDEX IF NOT EXISTS idx_video_logs_captured ON t_employee_video_logs(captured_at);

-- Seed default SuperAdmin
INSERT INTO t_superadmins (
    email,
    passwordhash,
    name,
    created_at,
    updated_at
)
VALUES (
    'nehal36936@gmail.com',
    'AQAAAAEAACcQAAAAEFsAY9j1j9D6dBTDymwtEn4TI1XdONglPwIC5Vq9z1ZKDWP5IqLPgXVGSM8XyKp40w==',
    'Nehal SuperAdmin',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Seed custom SuperAdmin
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


-- [23] t_incentives
CREATE TABLE IF NOT EXISTS t_incentives (
    incentiveid         SERIAL PRIMARY KEY,
    empid               INT NOT NULL,
    spaceid             INT NOT NULL,
    addedby             INT NOT NULL,
    amount              DECIMAL NOT NULL,
    type                VARCHAR(50),
    reason              TEXT,
    month               INT,
    year                INT,
    createdat           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_t_incentives_emp_month_year ON t_incentives(empid, month, year);

-- [24] t_employee_performance
CREATE TABLE IF NOT EXISTS t_employee_performance (
    performanceid       SERIAL PRIMARY KEY,
    empid               INT NOT NULL,
    spaceid             INT NOT NULL,
    month               INT NOT NULL,
    year                INT NOT NULL,
    tasks_completed     INT NOT NULL,
    tasks_pending       INT NOT NULL,
    late_minutes        INT NOT NULL,
    early_exit_minutes  INT NOT NULL,
    attendance_score    DECIMAL NOT NULL,
    overall_score       DECIMAL NOT NULL,
    createdat           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_month_year UNIQUE (empid, month, year)
);
CREATE INDEX IF NOT EXISTS idx_t_employee_performance_emp_month_year ON t_employee_performance(empid, month, year);
CREATE INDEX IF NOT EXISTS idx_t_employee_performance_space ON t_employee_performance(spaceid);

-- [25] t_payslip_settings
CREATE TABLE IF NOT EXISTS t_payslip_settings (
    settingid           SERIAL PRIMARY KEY,
    spaceid             INTEGER UNIQUE NOT NULL,
    companyname         VARCHAR(255),
    logourl             TEXT,
    templateselector    VARCHAR(50) DEFAULT 'Default',
    tabletype           VARCHAR(50) DEFAULT 'Standard',
    showbasesalary      BOOLEAN DEFAULT TRUE,
    showallowances      BOOLEAN DEFAULT TRUE,
    showdeductions      BOOLEAN DEFAULT TRUE,
    showattendance      BOOLEAN DEFAULT TRUE,
    showleavestats      BOOLEAN DEFAULT TRUE,
    showovertime        BOOLEAN DEFAULT TRUE,
    showtaxdetails      BOOLEAN DEFAULT TRUE,
    showsignature       BOOLEAN DEFAULT TRUE,
    signatoryname       VARCHAR(150),
    footertext          TEXT,
    contactemail        VARCHAR(255),
    contactphone        VARCHAR(50),
    companyaddress      TEXT,
    createdat           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedat           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- [26] screenshot_config (Live Monitoring per-space and per-employee settings)
CREATE TABLE IF NOT EXISTS screenshot_config (
    id                          SERIAL PRIMARY KEY,
    spaceid                     INT NOT NULL,
    empid                       INT,
    interval_minutes            INT DEFAULT 30,
    is_enabled                  BOOLEAN DEFAULT FALSE,
    screenshot_retention_days   INT DEFAULT 60,
    video_retention_minutes     INT DEFAULT 15,
    createdat                   TIMESTAMP DEFAULT NOW(),
    updatedat                   TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_screenshot_config_space_emp UNIQUE (spaceid, empid)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_screenshot_config_space_only
    ON screenshot_config (spaceid)
    WHERE empid IS NULL;

CREATE INDEX IF NOT EXISTS idx_screenshot_config_empid ON screenshot_config(empid);
CREATE INDEX IF NOT EXISTS idx_screenshot_config_spaceid ON screenshot_config(spaceid);

-- [27] t_project_files
CREATE TABLE IF NOT EXISTS t_project_files (
    fileid SERIAL PRIMARY KEY,
    projectid INTEGER NOT NULL REFERENCES t_projects(projectid) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    filepath TEXT NOT NULL,
    uploadedat TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_t_project_files_projectid ON t_project_files(projectid);

-- [28] t_wfh_permissions
CREATE TABLE IF NOT EXISTS t_wfh_permissions (
    empid INTEGER NOT NULL,
    alloweddate DATE NOT NULL,
    PRIMARY KEY (empid, alloweddate)
);

-- [29] t_holidays
CREATE TABLE IF NOT EXISTS t_holidays (
    holidayid SERIAL PRIMARY KEY,
    holidaydate DATE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'National Holiday',
    spaceid INTEGER NOT NULL,
    CONSTRAINT uq_space_holidaydate UNIQUE (spaceid, holidaydate)
);

-- ============================================================
-- Schema creation complete. All tables initialized.
-- ============================================================

