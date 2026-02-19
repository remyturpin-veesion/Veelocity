import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TourState {
  hasCompletedTour: boolean;
  isRunning: boolean;
  /** Which page-group of the tour we're on (0 = Dashboard, 1 = DORA, …) */
  groupIndex: number;
  /** Step within the current group */
  stepIndex: number;
  startTour: () => void;
  stopTour: () => void;
  setGroupIndex: (n: number) => void;
  setStepIndex: (n: number) => void;
  markCompleted: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasCompletedTour: false,
      isRunning: false,
      groupIndex: 0,
      stepIndex: 0,
      startTour() {
        set({ isRunning: true, groupIndex: 0, stepIndex: 0 });
      },
      stopTour() {
        set({ isRunning: false });
      },
      setGroupIndex(n) {
        set({ groupIndex: n, stepIndex: 0 });
      },
      setStepIndex(n) {
        set({ stepIndex: n });
      },
      markCompleted() {
        set({ hasCompletedTour: true, isRunning: false });
      },
    }),
    {
      name: 'veelocity-tour',
      partialize: (state) => ({ hasCompletedTour: state.hasCompletedTour }),
    }
  )
);
