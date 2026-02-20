import { useCallback, useEffect, useRef, useState } from 'react';
import Joyride, { type CallBackProps, type TooltipRenderProps, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/theme.js';
import { useTourStore } from '@/stores/tour.js';
import { TOUR_GROUPS, getGroupOffset, TOTAL_TOUR_STEPS } from '@/tour/tourSteps.js';

/** ms to wait after navigation for lazy-loaded screens to render */
const MOUNT_DELAY_MS = 600;

export function GuidedTour() {
  const isRunning = useTourStore((s) => s.isRunning);
  const groupIndex = useTourStore((s) => s.groupIndex);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const setGroupIndex = useTourStore((s) => s.setGroupIndex);
  const setStepIndex = useTourStore((s) => s.setStepIndex);
  const markCompleted = useTourStore((s) => s.markCompleted);
  const theme = useThemeStore((s) => s.theme);

  const navigate = useNavigate();
  const location = useLocation();

  const [ready, setReady] = useState(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const group = TOUR_GROUPS[groupIndex];
  const isDark = theme === 'dark';
  const isLastGroup = groupIndex === TOUR_GROUPS.length - 1;
  const groupOffset = getGroupOffset(groupIndex);

  // Whenever the tour starts or groupIndex changes, navigate to the
  // group's route (if needed) and wait for the screen to mount.
  useEffect(() => {
    if (!isRunning || !group) return;

    // Intentionally reset ready when deps change so we re-wait after navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync ready with route + delay
    setReady(false);
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);

    if (location.pathname !== group.route) {
      navigate(group.route);
      // The next effect run (triggered by location change) will set ready.
      return;
    }

    // Already on the right route — wait for lazy screen to render.
    delayTimerRef.current = setTimeout(() => setReady(true), MOUNT_DELAY_MS);
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, [isRunning, groupIndex, location.pathname, group, navigate]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;

      // ── User explicitly skipped or closed ──
      if (status === STATUS.SKIPPED) {
        markCompleted();
        return;
      }
      if (action === ACTIONS.CLOSE) {
        markCompleted();
        return;
      }

      // ── Joyride says this group is finished ──
      if (status === STATUS.FINISHED) {
        const nextGroup = groupIndex + 1;
        if (nextGroup >= TOUR_GROUPS.length) {
          markCompleted();
        } else {
          setGroupIndex(nextGroup);
        }
        return;
      }

      // ── Step-level navigation (Next / Back) ──
      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.NEXT) {
          setStepIndex(index + 1);
        } else if (action === ACTIONS.PREV) {
          setStepIndex(Math.max(0, index - 1));
        }
      }
    },
    [groupIndex, setGroupIndex, setStepIndex, markCompleted],
  );

  // Tooltip component that closes over current values (no ref mutation during render).
  const Tooltip = useCallback(
    function CustomTooltip({
      backProps,
      closeProps,
      continuous,
      index,
      isLastStep,
      primaryProps,
      skipProps,
      step,
      tooltipProps,
    }: TooltipRenderProps) {
      const globalStep = groupOffset + index + 1;
      const isAbsoluteLastStep = isLastGroup && isLastStep;

      const primary =
        getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6366f1';
      const bg = isDark ? '#1e293b' : '#ffffff';
      const text = isDark ? '#e2e8f0' : '#1e293b';
      const muted = isDark ? '#94a3b8' : '#64748b';

      return (
        <div
          {...tooltipProps}
          style={{
            background: bg,
            color: text,
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '380px',
            minWidth: '280px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            position: 'relative',
            fontFamily: 'inherit',
          }}
        >
          <button
            {...closeProps}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              color: muted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
          {step.title && (
            <h4
              style={{
                margin: '0 0 10px',
                fontSize: '1rem',
                fontWeight: 600,
                paddingRight: '24px',
                color: text,
              }}
            >
              {step.title as string}
            </h4>
          )}
          <div
            style={{
              fontSize: '0.875rem',
              lineHeight: 1.5,
              marginBottom: '16px',
              color: text,
            }}
          >
            {step.content as React.ReactNode}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              {...skipProps}
              style={{
                background: 'none',
                border: 'none',
                color: muted,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              Skip tour
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {index > 0 && (
                <button
                  {...backProps}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: muted,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    padding: '6px 8px',
                  }}
                >
                  Back
                </button>
              )}
              {continuous && (
                <button
                  {...primaryProps}
                  style={{
                    background: primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8125rem',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {isAbsoluteLastStep
                    ? 'Finish'
                    : `Next (Step ${globalStep} of ${TOTAL_TOUR_STEPS})`}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    },
    [groupOffset, isLastGroup, isDark],
  );

  if (!isRunning || !group || !ready) return null;

  return (
    <Joyride
      key={groupIndex}
      steps={group.steps}
      run
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      disableCloseOnEsc
      disableOverlayClose
      callback={handleCallback}
      tooltipComponent={Tooltip}
      styles={{
        options: {
          zIndex: 9000,
          overlayColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
    />
  );
}
