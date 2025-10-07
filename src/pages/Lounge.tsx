/**
 * @fileoverview Lounge - User Dashboard
 * @module pages/Lounge
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Activity, LogOut } from 'lucide-react';

interface UpcomingMeeting {
  id: string;
  time: Date;
  participantName: string;
  roomId: string;
}

interface Activity {
  type: string;
  message: string;
  createdAt: Date;
}

const Lounge = () => {
  const navigate = useNavigate();
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  useEffect(() => {
    // TODO: Fetch lounge data from API
    // const fetchData = async () => {
    //   const response = await fetch('/api/lounge/summary', {
    //     headers: { Authorization: `Bearer ${token}` }
    //   });
    //   const data = await response.json();
    //   setUpcomingMeetings(data.upcomingMeetings);
    //   setPendingRequestsCount(data.pendingRequestsCount);
    //   setRecentActivities(data.recentActivities);
    // };
    // fetchData();

    // Mock data
    setPendingRequestsCount(3);
    setRecentActivities([
      {
        type: 'friend_request',
        message: 'John Doe accepted your friend request',
        createdAt: new Date(Date.now() - 3600000)
      }
    ]);
  }, []);

  const handleLogout = () => {
    // TODO: Clear auth token
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/ponslink-logo.svg" alt="PonsLink" className="h-8 w-8" />
              <h1 className="text-2xl font-bold">PonsLink</h1>
            </div>
            <nav className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/profile/me')}>
                Profile
              </Button>
              <Button variant="ghost" onClick={() => navigate('/contacts')}>
                Contacts
              </Button>
              <Button variant="ghost" onClick={() => navigate('/messages')}>
                Messages
              </Button>
              <Button variant="ghost" onClick={() => navigate('/board')}>
                Board
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Welcome to your Lounge</h2>
          <p className="text-muted-foreground mt-2">
            Your personal hub for connections and meetings
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Upcoming Meetings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Upcoming Meetings</CardTitle>
              </div>
              <CardDescription>Your scheduled connections</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming meetings scheduled
                </p>
              ) : (
                <div className="space-y-4">
                  {upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="space-y-2">
                      <p className="text-sm font-medium">
                        Meeting with {meeting.participantName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {meeting.time.toLocaleString()}
                      </p>
                      <Button size="sm" onClick={() => navigate(`/room/${meeting.roomId}`)}>
                        Join Now
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Pending Requests</CardTitle>
              </div>
              <CardDescription>Connection requests waiting</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequestsCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending requests
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-2xl font-bold">{pendingRequestsCount}</p>
                  <p className="text-sm text-muted-foreground">
                    new connection requests
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/requests')}
                  >
                    View Requests
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Recent Activity</CardTitle>
              </div>
              <CardDescription>What's happening</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent activity
                </p>
              ) : (
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="space-y-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Lounge;
