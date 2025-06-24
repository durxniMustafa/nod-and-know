import React, { useMemo } from 'react';
import { dataService } from '@/services/dataService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

const Stats = () => {
  const session = dataService.getSessionData();
  const events = dataService.getAnalyticsEvents();

  const voteData = useMemo(() => {
    return Object.values(session.votes).map((v: any) => ({
      question: `Q${v.questionId + 1}`,
      yes: v.yes,
      no: v.no,
    }));
  }, [session.votes]);

  const gestureCounts = useMemo(() => {
    let yes = 0;
    let no = 0;
    events.forEach((e: any) => {
      if (e.type === 'gesture_detected') {
        if (e.data.gesture === 'yes') yes++;
        if (e.data.gesture === 'no') no++;
      }
    });
    return { yes, no };
  }, [events]);

  const gestureData = [
    { gesture: 'Yes', count: gestureCounts.yes },
    { gesture: 'No', count: gestureCounts.no },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-semibold">Session Statistics</h1>
          <Link to="/">
            <Button variant="outline" size="sm">Back</Button>
          </Link>
        </div>

        <Card className="bg-black/50 border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Vote Trends</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart data={voteData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                <XAxis dataKey="question" stroke="#ddd" />
                <YAxis allowDecimals={false} stroke="#ddd" />
                <Tooltip />
                <Legend />
                <Bar dataKey="yes" fill="#22c55e" name="Yes" />
                <Bar dataKey="no" fill="#ef4444" name="No" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-black/50 border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Gesture Frequency</h2>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart data={gestureData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                <XAxis dataKey="gesture" stroke="#ddd" />
                <YAxis allowDecimals={false} stroke="#ddd" />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Stats;
