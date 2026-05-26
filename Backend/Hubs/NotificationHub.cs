using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace Backend.Hubs
{
    public class NotificationHub : Hub
    {
        // Clients can call this to be dynamically grouped by SpaceId if targeted messaging is needed
        public async Task JoinSpaceGroup(string spaceId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Space_{spaceId}");
        }

        public async Task LeaveSpaceGroup(string spaceId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Space_{spaceId}");
        }
    }
}
