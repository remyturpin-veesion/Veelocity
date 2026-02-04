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

/** Format date range for display (e.g. "Jan 26, 2026 – Feb 3, 2026"). */
export function formatDateRangeDisplay(startDate: string, endDate: string): string {
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(startDate)} – ${fmt(endDate)}`;
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

/** Sentinel for "no author" filter; backend returns empty when this is passed. */
export const AUTHOR_LOGIN_NONE = '__none__';

interface FiltersState {
  dateRange: DateRangeState;
  repoIds: Set<number>;
  developerLogins: Set<string>;
  teamIds: Set<number>;
  timeInStateStageIds: Set<string>;

  setDateRangePreset: (preset: TimePeriodKey) => void;
  setDateRangeCustom: (start: string, end: string) => void;
  setRepoIds: (ids: Set<number> | number[]) => void;
  setDeveloperLogins: (logins: Set<string> | string[]) => void;
  setTeamIds: (ids: Set<number> | number[]) => void;
  setTimeInStateStageIds: (ids: Set<string> | string[]) => void;

  /** Empty set = no filter (0 values). Size 1 = that repo. Size > 1 = all repos (null). */
  getRepoIdForApi: () => number | null;
  /** Empty set = no filter (0 values). Size 1 = that author. Size > 1 = all (null). */
  getAuthorLoginForApi: () => string | null;
  /** Empty set = no filter (0 values). Non-empty = those team ids. */
  getTeamIdsForApi: () => number[] | undefined;
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
        set({ teamIds: new Set(ids instanceof Set ? ids : ids) });
      },

      setTimeInStateStageIds(ids) {
        set({
          timeInStateStageIds: ids instanceof Set ? ids : new Set(ids),
        });
      },

      getRepoIdForApi() {
        const { repoIds } = get();
        if (repoIds.size === 0) return -1;
        return repoIds.size === 1 ? [...repoIds][0]! : null;
      },

      getAuthorLoginForApi() {
        const { developerLogins } = get();
        if (developerLogins.size === 0) return AUTHOR_LOGIN_NONE;
        return developerLogins.size === 1 ? [...developerLogins][0]! : null;
      },

      getTeamIdsForApi() {
        const { teamIds } = get();
        if (teamIds.size === 0) return [];
        return Array.from(teamIds);
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
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          dateRange?: DateRangeState;
          repoIds?: number[];
          developerLogins?: string[];
          teamIds?: number[];
          timeInStateStageIds?: string[];
        };
        return {
          ...current,
          dateRange: p.dateRange ?? current.dateRange,
          repoIds: p.repoIds ? new Set(p.repoIds) : current.repoIds,
          developerLogins: p.developerLogins ? new Set(p.developerLogins) : current.developerLogins,
          teamIds: p.teamIds ? new Set(p.teamIds) : current.teamIds,
          timeInStateStageIds: p.timeInStateStageIds ? new Set(p.timeInStateStageIds) : current.timeInStateStageIds,
        };
      },
    }
  )
);
