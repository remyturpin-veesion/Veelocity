import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Same shape as API response; teams are loaded from the server. */
export interface DeveloperTeam {
  id: string;
  name: string;
  members: string[];
}

interface DeveloperTeamsState {
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
}

export const useDeveloperTeamsStore = create<DeveloperTeamsState>()(
  persist(
    (set) => ({
      activeTeamId: null,
      setActiveTeamId(id) {
        set({ activeTeamId: id });
      },
    }),
    { name: 'veelocity-developer-teams' }
  )
);
