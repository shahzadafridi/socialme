import type { Brand, Settings } from '@/lib/core/types';
import { Card, Field, Input, Note, TextArea, Select } from '@/entrypoints/options/ui';

export function BrandTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const brand = settings.brand;
  const set = (patch: Partial<Brand>) => onChange({ brand: { ...brand, ...patch } });
  const filled = Object.entries(brand).filter(([key, value]) => key !== 'mode' && typeof value === 'string' && value.trim()).length;

  return (
    <>
      <div>
        <h1>Brand</h1>
        <p className="lede">
          Your brand gives the assistant context about your work, beliefs and real experience.
          Everyday replies can stay everyday replies. You choose when professional context belongs.
        </p>
      </div>

      <Note>
        {filled === 0
          ? 'Nothing filled in yet — drafts still work, they will just be less recognisably yours. Start with positioning and pillars; those two change the output the most.'
          : `${filled} of 9 fields set. Positioning and pillars carry most of the weight.`}
      </Note>

      <Card title="When should your brand shape a reply?">
        <Field label="Brand context">
          <Select value={brand.mode ?? 'relevant'} onChange={(mode) => set({ mode: mode as Brand['mode'] })} options={[
            { value: 'relevant', label: 'Only when relevant (recommended)' },
            { value: 'strict', label: 'Stay within my professional topics' },
            { value: 'off', label: 'Use my voice without brand context' },
          ]} />
        </Field>
        <p className="card__desc">Your “Never claim or discuss” rules always apply. Writing examples never count as proof of professional experience.</p>
      </Card>

      <Card title="What you are building" desc="Written in the first person, as a brief to a ghostwriter.">
        <Field label="Name or handle" hint="How you refer to yourself in the brief." >
          <Input
            value={brand.name}
            onChange={(value) => set({ name: value })}
            placeholder="Shahzad — independent product engineer"
          />
        </Field>

        <Field
          label="Positioning"
          hint="One or two sentences: who you help, with what, and the proof. The single most useful field."
        >
          <TextArea
            value={brand.positioning}
            onChange={(value) => set({ positioning: value })}
            rows={3}
            placeholder="I help small SaaS teams ship faster by fixing the parts of their delivery process that quietly waste weeks. 11 years building product, 40+ shipped projects."
          />
        </Field>

        <Field
          label="Content pillars"
          hint="3–5 topics you know. One per line. Relevant conversations can draw on these; unrelated replies do not need a brand connection."
        >
          <TextArea
            value={brand.pillars}
            onChange={(value) => set({ pillars: value })}
            rows={5}
            placeholder={'Shipping software without a big team\nHiring and working with engineers\nPricing and scoping client work\nWhy most roadmaps are fiction'}
          />
        </Field>

        <Field
          label="Point of view"
          hint="What you believe that most people in your field do not. This is what makes a reply worth reading."
        >
          <TextArea
            value={brand.pov}
            onChange={(value) => set({ pov: value })}
            rows={3}
            placeholder="Most delivery problems are decision problems. Teams don't need more process, they need fewer approvals."
          />
        </Field>
      </Card>

      <Card title="Material you can actually use" desc="Only real things. The model is told never to invent numbers or client stories.">
        <Field
          label="Proof"
          hint="Real numbers, clients, outcomes, timeline. Anything the model may cite."
        >
          <TextArea
            value={brand.proof}
            onChange={(value) => set({ proof: value })}
            rows={3}
            placeholder="Cut a client's release cycle from 3 weeks to 4 days. 40+ projects shipped. 11 years."
          />
        </Field>

        <Field
          label="Signature stories"
          hint="The 2-3 anecdotes you retell. Short beats long."
        >
          <TextArea
            value={brand.stories}
            onChange={(value) => set({ stories: value })}
            rows={3}
            placeholder="The staging-branch deletion. The client who paid for a rewrite we talked them out of."
          />
        </Field>

        <div className="grid-2">
          <Field
            label="What you want inbound for"
            hint="Never pitched directly in a comment — it only shapes what you are credible about."
          >
            <Input
              value={brand.offer}
              onChange={(value) => set({ offer: value })}
              placeholder="Fractional engineering leadership, delivery audits"
            />
          </Field>
          <Field label="What this is for" hint="Your goal, in your words.">
            <Input
              value={brand.goals}
              onChange={(value) => set({ goals: value })}
              placeholder="Be the person founders think of when delivery stalls"
            />
          </Field>
        </div>

        <Field
          label="Never claim or discuss"
          hint="Compliance, clients you cannot name, topics that would get you in trouble."
        >
          <TextArea
            value={brand.forbidden}
            onChange={(value) => set({ forbidden: value })}
            rows={2}
            placeholder="Never name clients without permission. No revenue claims. No politics."
          />
        </Field>
      </Card>
    </>
  );
}
