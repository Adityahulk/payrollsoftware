using Microsoft.AspNetCore.SignalR;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Backend.Hubs
{
    public class ScreenShareHub : Hub
    {
        // ── OnConnectedAsync ────────────────────────────────────────────────────────
        // When an authenticated employee connects, auto-join a personal group named
        // "Emp_{empId}" so the admin can target them directly by EmpId, completely
        // bypassing the spaceId room matching which is fragile.
        public override async Task OnConnectedAsync()
        {
            var empIdClaim = Context.User?.FindFirst("EmpId")?.Value
                          ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (!string.IsNullOrEmpty(empIdClaim) && int.TryParse(empIdClaim, out var empId) && empId > 0)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Emp_{empId}");
                Console.WriteLine($"[ScreenShareHub] empId={empId} joined personal group Emp_{empId} | connId={Context.ConnectionId}");
            }

            await base.OnConnectedAsync();
        }

        public async Task JoinRoom(int spaceId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"ShareRoom_{spaceId}");
            await Clients.OthersInGroup($"ShareRoom_{spaceId}").SendAsync("UserJoined", Context.ConnectionId);
        }

        public async Task LeaveRoom(int spaceId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"ShareRoom_{spaceId}");
            await Clients.OthersInGroup($"ShareRoom_{spaceId}").SendAsync("UserLeft", Context.ConnectionId);
        }

        // ── InitiateScreenRequest ───────────────────────────────────────────────────
        // Targets the employee's PERSONAL group (Emp_{empId}) first — this works
        // regardless of whether spaceId matches. Also sends to the space room as a
        // fallback for clients that didn't authenticate (e.g. unauthenticated test).
        public async Task InitiateScreenRequest(int targetEmpId, int spaceId)
        {
            Console.WriteLine($"[ScreenShareHub] Screen request: targetEmpId={targetEmpId}, spaceId={spaceId}, from={Context.ConnectionId}");

            // Primary: target the employee by their personal group
            await Clients.Group($"Emp_{targetEmpId}").SendAsync(
                "RequestScreenShare", targetEmpId, Context.ConnectionId);

            // Fallback: also broadcast to the space room (for unauthenticated connections)
            if (spaceId > 0)
            {
                await Clients.OthersInGroup($"ShareRoom_{spaceId}").SendAsync(
                    "RequestScreenShare", targetEmpId, Context.ConnectionId);
            }
        }

        public async Task SendOffer(string targetConnectionId, string sdp)
        {
            Console.WriteLine($"[ScreenShareHub] SendOffer → {targetConnectionId}");
            await Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", Context.ConnectionId, sdp);
        }

        public async Task SendAnswer(string targetConnectionId, string sdp)
        {
            Console.WriteLine($"[ScreenShareHub] SendAnswer → {targetConnectionId}");
            await Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", Context.ConnectionId, sdp);
        }

        public async Task SendIceCandidate(string targetConnectionId, string candidate)
        {
            await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", Context.ConnectionId, candidate);
        }

        public async Task NotifyScreenShareActive(int empId, int spaceId, bool isActive)
        {
            Console.WriteLine($"[ScreenShareHub] StreamStateChanged: empId={empId}, isActive={isActive}");
            // Broadcast to space room (admin is in the space room)
            await Clients.Group($"ShareRoom_{spaceId}").SendAsync(
                "StreamStateChanged", empId, Context.ConnectionId, isActive);
        }
    }
}
