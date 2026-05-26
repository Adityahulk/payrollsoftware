namespace Backend.Repositories;

using System.Threading.Tasks;
using System.Collections.Generic;
using Backend.Models;

public interface IProfileRepository
{
    Task<ProfileResponse?> GetProfileAsync(int empId);
    Task<bool> UpdateProfileAsync(int empId, UpdateProfileRequest request);
    Task<bool> UpdateProfilePhotoAsync(int empId, string photoUrl);
    Task<int> SaveDocumentAsync(DocumentRecord doc);
    Task<IEnumerable<DocumentRecord>> GetDocumentsByEmpIdAsync(int empId);
    Task<bool> DeleteDocumentAsync(int docId, int empId);
}
