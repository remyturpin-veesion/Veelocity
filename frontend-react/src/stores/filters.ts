import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimePeriodKey = '7' | '30' | '90';

export interface DateRangeState {
  preset: TimePeriodKey | null;
  customStart: string | null;
  customEnd: string | null;
}

function getDefaultDateRange(): DateRangeState {
  return { preset: '30', customStart: null, customEnd: null };
}

function periodToDays(p: TimePeriodKey): number {
  return p === '7' ? 7 : p === '30' ? 30 : 90;
}

export function toStartEnd(state: DateRangeState): { startDate: string; endDate: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (state.preset) {
    const days = periodToDays(state.preset);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }
  if (state.customStart && state.customEnd) {
    return { startDate: state.customStart, endDate: state.customEnd };
  }
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export const LINEAR_SIDEBAR_IDS = ['overview', 'issues-completed', 'backlog', 'time-in-state'] as const;
export type LinearSidebarId = (typeof LINEAR_SIDEBAR_IDS)[number];

function getDefaultLinearSidebarSelection(): Set<string> {
  return new Set(LINEAR_SIDEBAR_IDS);
}

interface FiltersState {
  dateRange: DateRangeState;
  repoIds: Set<number>;
  developerLogins: Set<string>;
  teamIds: Set<number>;
  timeInStateStageIds: Set<string>;
  linearSidebarSelection: Set<string>;

  setDateRangePreset: (preset: TimePeriodKey) => void;
  setDateRangeCustom: (start: string, end: string) => void;
  setRepoIds: (ids: Set<number> | number[]) => void;
  setDeveloperLogins: (logins: Set<string> | string[]) => void;
  setTeamIds: (ids: Set<number> | number[]) => void;
  setTimeInStateStageIds: (ids: Set<string> | string[]) => void;
  toggleLinearSidebarItem: (id: string) => void;

  getRepoIdForApi: () => number | null;
  getStartEnd: () => { startDate: string; endDate: string };
}

const persistKey = 'veelocity-filters';

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set, get) => ({
      dateRange: getDefaultDateRange(),
      repoIds: new Set(),
      developerLogins: new Set(),
      teamIds: new Set(),
      timeInStateStageIds: new Set(),
      linearSidebarSelection: getDefaultLinearSidebarSelection(),

      setDateRangePreset(preset) {
        set({
          dateRange: { preset, customStart: null, customEnd: null },
        });
      },

      setDateRangeCustom(start, end) {
        set({
          dateRange: { preset: null, customStart: start, customEnd: end },
        });
      },

      setRepoIds(ids) {
        set({
          repoIds: ids instanceof Set ? ids : new Set(ids),
        });
      },

      setDeveloperLogins(logins) {
        set({
          developerLogins: logins instanceof Set ? logins : new Set(logins),
        });
      },

      setTeamIds(ids) {
        set({
          teamIds: ids instanceof Set ? ids : new Set(ids),
        });
      },

      setTimeInStateStageIds(ids) {
        set({
          timeInStateStageIds: ids instanceof Set ? ids : new Set(ids),
        });
      },

      toggleLinearSidebarItem(id) {
        const { linearSidebarSelection } = get();
        const next = new Set(linearSidebarSelection);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        set({ linearSidebarSelection: next });
      },

      getRepoIdForApi() {
        const { repoIds } = get();
        return repoIds.size === 1 ? [...repoIds][0]! : null;
      },

      getStartEnd() {
        return toStartEnd(get().dateRange);
      },
    }),
    {
      name: persistKey,
      partialize: (s) => ({
        dateRange: s.dateRange,
        repoIds: Array.from(s.repoIds),
        developerLogins: Array.from(s.developerLogins),
        teamIds: Array.from(s.teamIds),
        timeInStateStageIds: Array.from(s.timeInStateStageIds),
        linearSidebarSelection: Array.from(s.linearSidebarSelection),
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          dateRange?: DateRangeState;
          repoIds?: number[];
          developerLogins?: string[];
          teamIds?: number[];
          timeInStateStageIds?: string[];
          linearSidebarSelection?: string[];
        };
        return {
          ...current,
          dateRange: p.dateRange ?? current.dateRange,
          repoIds: p.repoIds ? new Set(p.repoIds) : current.repoIds,
          developerLogins: p.developerLogins ? new Set(p.developerLogins) : current.developerLogins,
          teamIds: p.teamIds ? new Set(p.teamIds) : current.teamIds,
          timeInStateStageIds: p.timeInStateStageIds ? new Set(p.timeInStateStageIds) : current.timeInStateStageIds,
          linearSidebarSelection: p.linearSidebarSelection ? new Set(p.linearSidebarSelection) : current.linearSidebarSelection,
        };
      },
    }
  )
);
