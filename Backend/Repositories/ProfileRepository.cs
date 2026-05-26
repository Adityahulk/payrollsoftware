namespace Backend.Repositories;

using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Backend.Models;
using Dapper;

public class ProfileRepository : IProfileRepository
{
    private readonly IDbConnection _db;

    public ProfileRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<ProfileResponse?> GetProfileAsync(int empId)
    {
        var sql = @"
            SELECT 
                empid,
                email,
                COALESCE(name, email) AS name,
                phone,
                address,
                gender,
                role,
                status,
                COALESCE(dateofjoining, CURRENT_DATE)::timestamp AS dateofjoining,
                profilephotourl,
                accountnumber,
                bankname,
                accountholdername,
                ifsccode,
                upiid
            FROM t_users
            WHERE empid = @EmpId";

        var profile = await _db.QueryFirstOrDefaultAsync<ProfileResponse>(sql, new { EmpId = empId });
        if (profile == null) return null;

        profile.Documents = (await GetDocumentsByEmpIdAsync(empId)).ToList();
        return profile;
    }

    public async Task<bool> UpdateProfileAsync(int empId, UpdateProfileRequest request)
    {
        var sql = @"
            UPDATE t_users
            SET 
                phone   = COALESCE(@Phone, phone),
                address = COALESCE(@Address, address),
                gender  = COALESCE(@Gender, gender),
                name    = COALESCE(@Name, name),
                accountnumber = COALESCE(@AccountNumber, accountnumber),
                bankname      = COALESCE(@BankName, bankname),
                accountholdername = COALESCE(@AccountHolderName, accountholdername),
                ifsccode      = COALESCE(@IfscCode, ifsccode),
                upiid         = COALESCE(@UpiId, upiid)
            WHERE empid = @EmpId";

        var affected = await _db.ExecuteAsync(sql, new
        {
            EmpId   = empId,
            Phone   = string.IsNullOrWhiteSpace(request.Phone)   ? (string?)null : request.Phone.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? (string?)null : request.Address.Trim(),
            Gender  = string.IsNullOrWhiteSpace(request.Gender)  ? (string?)null : request.Gender.Trim(),
            Name    = string.IsNullOrWhiteSpace(request.Name)    ? (string?)null : request.Name.Trim(),
            AccountNumber = string.IsNullOrWhiteSpace(request.AccountNumber) ? (string?)null : request.AccountNumber.Trim(),
            BankName = string.IsNullOrWhiteSpace(request.BankName) ? (string?)null : request.BankName.Trim(),
            AccountHolderName = string.IsNullOrWhiteSpace(request.AccountHolderName) ? (string?)null : request.AccountHolderName.Trim(),
            IfscCode = string.IsNullOrWhiteSpace(request.IfscCode) ? (string?)null : request.IfscCode.Trim(),
            UpiId = string.IsNullOrWhiteSpace(request.UpiId) ? (string?)null : request.UpiId.Trim(),
        });
        return affected > 0;
    }

    public async Task<bool> UpdateProfilePhotoAsync(int empId, string photoUrl)
    {
        var sql = @"UPDATE t_users SET profilephotourl = @PhotoUrl WHERE empid = @EmpId";
        var affected = await _db.ExecuteAsync(sql, new { EmpId = empId, PhotoUrl = photoUrl });
        return affected > 0;
    }

    public async Task<int> SaveDocumentAsync(DocumentRecord doc)
    {
        // Upsert: if same empId + documentType exists, update it
        var sql = @"
            INSERT INTO t_emp_documents (empid, documenttype, documentnumber, fileurl, uploadedat)
            VALUES (@EmpId, @DocumentType, @DocumentNumber, @FileUrl, NOW())
            ON CONFLICT (empid, documenttype)
            DO UPDATE SET 
                documentnumber = EXCLUDED.documentnumber,
                fileurl = EXCLUDED.fileurl,
                uploadedat = NOW()
            RETURNING docid";
        return await _db.ExecuteScalarAsync<int>(sql, doc);
    }

    public async Task<IEnumerable<DocumentRecord>> GetDocumentsByEmpIdAsync(int empId)
    {
        var sql = @"
            SELECT docid, empid, documenttype, documentnumber, fileurl, uploadedat::timestamp AS uploadedat
            FROM t_emp_documents
            WHERE empid = @EmpId
            ORDER BY uploadedat DESC";
        return await _db.QueryAsync<DocumentRecord>(sql, new { EmpId = empId });
    }

    public async Task<bool> DeleteDocumentAsync(int docId, int empId)
    {
        var sql = @"DELETE FROM t_emp_documents WHERE docid = @DocId AND empid = @EmpId";
        var affected = await _db.ExecuteAsync(sql, new { DocId = docId, EmpId = empId });
        return affected > 0;
    }
}
