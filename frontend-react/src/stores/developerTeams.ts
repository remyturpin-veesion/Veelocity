import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DeveloperTeam {
  id: string;
  name: string;
  members: string[]; // GitHub logins
}

interface DeveloperTeamsState {
  teams: DeveloperTeam[];
  activeTeamId: string | null;

  addTeam: (name: string, members: string[]) => void;
  updateTeam: (id: string, name: string, members: string[]) => void;
  deleteTeam: (id: string) => void;
  setActiveTeamId: (id: string | null) => void;
}

export const useDeveloperTeamsStore = create<DeveloperTeamsState>()(
  persist(
    (set) => ({
      teams: [],
      activeTeamId: null,

      addTeam(name, members) {
        const id = crypto.randomUUID();
        set((s) => ({ teams: [...s.teams, { id, name, members }] }));
      },

      updateTeam(id, name, members) {
        set((s) => ({
          teams: s.teams.map((t) => (t.id === id ? { ...t, name, members } : t)),
        }));
      },

      deleteTeam(id) {
        set((s) => ({
          teams: s.teams.filter((t) => t.id !== id),
          activeTeamId: s.activeTeamId === id ? null : s.activeTeamId,
        }));
      },

      setActiveTeamId(id) {
        set({ activeTeamId: id });
      },
    }),
    {
      name: 'veelocity-developer-teams',
    }
  )
);
