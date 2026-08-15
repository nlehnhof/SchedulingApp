'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, postJSON } from '@/lib/fetcher';
import type { Rule } from '@/lib/types';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import RuleEditor, { RuleFormValues } from '@/components/RuleEditor';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RULES_KEY = '/api/client/rules';

function summarize(rule: Rule): string {
  if (rule.rule_type === 'available_hours') {
    const day = rule.day_of_week === null ? 'Every day' : DAY_LABELS[rule.day_of_week];
    return `${day}: ${rule.start_time?.slice(0, 5)}–${rule.end_time?.slice(0, 5)}`;
  }
  if (rule.rule_type === 'max_per_window') {
    const windowMin = (rule.config as any)?.window_minutes ?? 60;
    return `Max ${rule.max_concurrent} appointments per ${windowMin} min`;
  }
  if (rule.rule_type === 'first_n_only') {
    const firstN = (rule.config as any)?.first_n;
    const windowMin = (rule.config as any)?.window_minutes ?? 60;
    return `First ${firstN} only per ${windowMin} min`;
  }
  if (rule.rule_type === 'blackout') {
    const start = (rule.config as any)?.start_date;
    const end = (rule.config as any)?.end_date;
    return `Blocked ${start} to ${end}`;
  }
  if (rule.rule_type === 'buffer_time') {
    const bufferMin = (rule.config as any)?.buffer_minutes;
    return `${bufferMin} min buffer before & after appointments`;
  }
  if (rule.rule_type === 'min_notice') {
    const hours = (rule.config as any)?.notice_hours;
    return `Requires ${hours}h notice before booking`;
  }
  return rule.rule_type;
}

function toFormValues(rule: Rule): RuleFormValues {
  return {
    ruleType: rule.rule_type,
    dayOfWeek: rule.day_of_week === null ? 'all' : String(rule.day_of_week),
    startTime: rule.start_time?.slice(0, 5) ?? '',
    endTime: rule.end_time?.slice(0, 5) ?? '',
    maxConcurrent: rule.max_concurrent != null ? String(rule.max_concurrent) : '',
    firstN: (rule.config as any)?.first_n != null ? String((rule.config as any).first_n) : '',
    windowMinutes:
      (rule.config as any)?.window_minutes != null ? String((rule.config as any).window_minutes) : '',
    blackoutStartDate: (rule.config as any)?.start_date ?? '',
    blackoutEndDate: (rule.config as any)?.end_date ?? '',
    bufferMinutes:
      (rule.config as any)?.buffer_minutes != null ? String((rule.config as any).buffer_minutes) : '',
    noticeHours:
      (rule.config as any)?.notice_hours != null ? String((rule.config as any).notice_hours) : '',
  };
}

// Rules previously rendered as a flat, unsorted list with no grouping by
// type or day, even though day-specific vs. all-days precedence and
// capacity-rule interactions matter for understanding what a visitor will
// actually see (PLAN.md Section 1/2 item 10).
const RULE_TYPE_ORDER: Record<Rule['rule_type'], number> = {
  available_hours: 0,
  blackout: 1,
  max_per_window: 2,
  first_n_only: 3,
  buffer_time: 4,
  min_notice: 5,
};

function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => {
    const typeDiff = RULE_TYPE_ORDER[a.rule_type] - RULE_TYPE_ORDER[b.rule_type];
    if (typeDiff !== 0) return typeDiff;
    if (a.rule_type === 'available_hours') {
      // "All days" (null) first as the base rule, then day-specific
      // overrides in weekday order.
      return (a.day_of_week ?? -1) - (b.day_of_week ?? -1);
    }
    return 0;
  });
}

function toRequestBody(values: RuleFormValues): Record<string, unknown> {
  const dayOfWeek = values.dayOfWeek === 'all' ? null : Number(values.dayOfWeek);
  const body: Record<string, unknown> = { ruleType: values.ruleType };
  if (values.ruleType === 'available_hours') {
    body.dayOfWeek = dayOfWeek;
    body.startTime = values.startTime;
    body.endTime = values.endTime;
    body.config = { permanent: dayOfWeek === null };
  } else if (values.ruleType === 'max_per_window') {
    body.maxConcurrent = Number(values.maxConcurrent);
    body.config = { window_minutes: Number(values.windowMinutes || 60) };
  } else if (values.ruleType === 'first_n_only') {
    body.config = {
      first_n: Number(values.firstN),
      window_minutes: Number(values.windowMinutes || 60),
    };
  } else if (values.ruleType === 'blackout') {
    body.config = {
      start_date: values.blackoutStartDate,
      end_date: values.blackoutEndDate,
    };
  } else if (values.ruleType === 'buffer_time') {
    body.config = { buffer_minutes: Number(values.bufferMinutes || 0) };
  } else if (values.ruleType === 'min_notice') {
    body.config = { notice_hours: Number(values.noticeHours || 0) };
  }
  return body;
}

export default function RulesPage() {
  const { data, error, isLoading } = useSWR<{ rules: Rule[] }>(RULES_KEY, fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function openCreate() {
    setEditingRule(null);
    setSubmitError(null);
    setModalOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditingRule(rule);
    setSubmitError(null);
    setModalOpen(true);
  }

  async function handleSave(values: RuleFormValues) {
    setSubmitError(null);
    const body = toRequestBody(values);
    try {
      if (editingRule) {
        const res = await fetch(`/api/client/rules/${editingRule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to save rule');
      } else {
        await postJSON('/api/client/rules', body);
      }
      setModalOpen(false);
      mutate(RULES_KEY);
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to save rule');
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/client/rules/${id}`, { method: 'DELETE' });
    if (res.ok) mutate(RULES_KEY);
    setConfirmDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl font-semibold text-text-primary">Rules Editor</h1>
        <Button onClick={openCreate}>New rule</Button>
      </div>

      {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Failed to load rules.</p>}
      {!!data?.rules.length && (
        <p className="text-sm text-text-secondary">
          Day-specific hours override an all-days rule for that day; blackout dates close a day
          entirely regardless of hours; the remaining capacity/timing rules (max per window,
          first N only, buffer time, minimum notice) apply on top of your hours.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sortRules(data?.rules ?? []).map((rule) => (
          <li
            key={rule.id}
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
          >
            <div className="flex flex-col">
              <span>{summarize(rule)}</span>
              <span className="text-xs uppercase tracking-wide text-text-secondary">{rule.rule_type}</span>
            </div>

            {confirmDeleteId === rule.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-danger">Delete this rule?</span>
                <Button variant="danger" onClick={() => handleDelete(rule.id)} className="px-2 py-1 text-xs">
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(rule)}
                  className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-accent-soft/20"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDeleteId(rule.id)}
                  className="rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
        {data?.rules.length === 0 && (
          <p className="text-sm text-text-secondary">
            No rules yet — visitors won&apos;t see any available slots until you add an
            available-hours rule.
          </p>
        )}
      </ul>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingRule ? 'Edit rule' : 'New rule'}>
        {submitError && <p className="mb-2 text-sm text-danger">{submitError}</p>}
        <RuleEditor
          key={editingRule?.id ?? 'new'}
          onSubmit={handleSave}
          onCancel={() => setModalOpen(false)}
          initialValues={editingRule ? toFormValues(editingRule) : undefined}
          submitLabel={editingRule ? 'Save changes' : 'Save rule'}
        />
      </Modal>
    </div>
  );
}
