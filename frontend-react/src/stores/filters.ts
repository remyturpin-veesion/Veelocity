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

/** Sentinel for "no repo" filter; backend returns empty when repo_id is this. */
export const REPO_ID_NONE = -1;

/** Sentinel for "no team" filter; backend returns empty when team_ids contains only this. */
export const TEAM_ID_NONE = -1;

/** Stable empty arrays returned by getters to avoid new references and infinite re-renders when used in selectors. */
const EMPTY_REPO_IDS: number[] = [];
const EMPTY_TEAM_IDS: number[] = [];

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
  /** Returns repo ids array for API (null = all, [] = none, [id,...] = filter). */
  getRepoIdsForApi: () => number[] | null;
  /** True when user selected "0 repos" — pages should show no data. */
  hasNoReposSelected: () => boolean;
  /** Empty set = no filter (0 values). Size 1 = that author. Size > 1 = all (null). */
  getAuthorLoginForApi: () => string | null;
  /** Empty set = no filter (0 values). Non-empty = those team ids. */
  getTeamIdsForApi: () => number[] | undefined;
  getStartEnd: () => { startDate: string; endDate: string };
  /** For charts: 'day' if date range < 2 months, else 'week'. */
  getChartPeriod: () => 'day' | 'week';
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
        if (repoIds.size === 0) return null;
        if (repoIds.size === 1) {
          const id = [...repoIds][0]!;
          return id === REPO_ID_NONE ? REPO_ID_NONE : id;
        }
        return null;
      },

      getRepoIdsForApi() {
        const { repoIds } = get();
        if (repoIds.size === 0) return null;
        const ids = Array.from(repoIds).filter((id) => id !== REPO_ID_NONE);
        if (ids.length === 0) return EMPTY_REPO_IDS; /* none selected */
        return ids;
      },

      hasNoReposSelected() {
        const ids = get().getRepoIdsForApi();
        return Array.isArray(ids) && ids.length === 0;
      },

      getAuthorLoginForApi() {
        const { developerLogins } = get();
        if (developerLogins.size === 0) return null;
        if (developerLogins.size === 1) {
          const login = [...developerLogins][0]!;
          return login === AUTHOR_LOGIN_NONE ? AUTHOR_LOGIN_NONE : login;
        }
        return null;
      },

      getTeamIdsForApi() {
        const { teamIds } = get();
        if (teamIds.size === 0) return EMPTY_TEAM_IDS;
        if (teamIds.size === 1 && teamIds.has(TEAM_ID_NONE)) return [TEAM_ID_NONE];
        return Array.from(teamIds).filter((id) => id !== TEAM_ID_NONE);
      },

      getStartEnd() {
        return toStartEnd(get().dateRange);
      },

      getChartPeriod() {
        const { startDate, endDate } = toStartEnd(get().dateRange);
        const days = Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return days < 60 ? 'day' : 'week';
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
