'use client';

import { useCoachStore } from '@/store/matchStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TEAM_FLAGS: Record<string, string> = {
  argentina: '🇦🇷',
  france: '🇫🇷',
  brazil: '🇧🇷',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  spain: '🇪🇸',
  germany: '🇩🇪',
  portugal: '🇵🇹',
  netherlands: '🇳🇱',
  usa: '🇺🇸',
  mexico: '🇲🇽',
  italy: '🇮🇹',
  belgium: '🇧🇪',
  colombia: '🇨🇴',
  japan: '🇯🇵',
};

export default function SetupPage() {
  const {
    teams,
    teamAId,
    teamBId,
    setTeamA,
    setTeamB,
    setStep,
  } = useCoachStore();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-4xl">🏆</div>
        <h2 className="text-2xl md:text-3xl font-bold">FIFA World Cup 2026</h2>
        <p className="text-muted-foreground">Pick two national teams and predict the outcome</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team A */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Home Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-[520px] overflow-y-auto">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setTeamA(team.id)}
                className={`w-full p-2.5 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                  teamAId === team.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{TEAM_FLAGS[team.id] || '🏳️'}</span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: team.color, color: team.textColor }}
                    >
                      {team.shortName}
                    </div>
                    <span className="font-medium text-sm">{team.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {team.overallRating}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Team B */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Away Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-[520px] overflow-y-auto">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setTeamB(team.id)}
                className={`w-full p-2.5 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                  teamBId === team.id
                    ? 'border-destructive bg-destructive/5 shadow-sm'
                    : 'border-border hover:border-destructive/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{TEAM_FLAGS[team.id] || '🏳️'}</span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: team.color, color: team.textColor }}
                    >
                      {team.shortName}
                    </div>
                    <span className="font-medium text-sm">{team.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {team.overallRating}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {teamAId === teamBId && (
        <p className="text-center text-destructive font-medium">Please select two different teams</p>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          disabled={teamAId === teamBId}
          onClick={() => setStep('tactics')}
          className="px-12 text-lg"
        >
          Configure Tactics →
        </Button>
      </div>
    </div>
  );
}
