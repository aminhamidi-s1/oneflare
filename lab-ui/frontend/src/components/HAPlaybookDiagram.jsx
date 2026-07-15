import {
  Zap, Search, Waypoints, Ban, FileText, ShieldCheck, Bell,
  CornerDownRight, ChevronDown,
} from 'lucide-react'

// Read-only, HA-editor-style node graph for a Hyperautomation workflow.
// Pure Tailwind + inline SVG/CSS — no canvas/drag library, no new deps.
//
// diagram.blocks is an ordered top-down list of blocks. Supported kinds:
//   trigger    { label, detail }
//   enrichment { nodes: [{ label, detail }] }                          — parallel row
//   gate       { label, detail, elseLabel }                            — single-branch pass gate
//   action     { nodes: [{ label, detail, variant }] }                 — sequential stack
//   decision   { label, detail, converge, branches: { true, false } }  — two-branch split (+ optional merge)
//   notify     { nodes: [{ label, detail }] }                          — final parallel row

function FlowConnector({ color = 'border-[#3a2465]' }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-px h-5 border-l ${color}`} />
      <ChevronDown className="w-3.5 h-3.5 text-[#4a3070] -mt-1" />
    </div>
  )
}

function TriggerCard({ label, detail }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-xl border-2 border-blue-500/40 bg-blue-500/10 px-5 py-3 max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-blue-200">{label}</span>
        </div>
        {detail && <p className="text-xs text-blue-300/70 leading-snug">{detail}</p>}
      </div>
    </div>
  )
}

const VARIANT_STYLES = {
  action: {
    border: 'border-orange-500/25', bg: 'bg-orange-500/5', text: 'text-orange-200',
    icon: ShieldCheck, iconColor: 'text-orange-400',
  },
  destructive: {
    border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-200',
    icon: Ban, iconColor: 'text-red-400',
  },
  note: {
    border: 'border-purple-500/25', bg: 'bg-purple-500/5', text: 'text-purple-200',
    icon: FileText, iconColor: 'text-purple-400',
  },
  notify: {
    border: 'border-slate-600/40', bg: 'bg-white/5', text: 'text-slate-200',
    icon: Bell, iconColor: 'text-slate-400',
  },
  enrichment: {
    border: 'border-cyan-500/30', bg: 'bg-cyan-500/5', text: 'text-cyan-200',
    icon: Search, iconColor: 'text-cyan-400',
  },
}

function NodeCard({ label, detail, variant = 'action', className = '' }) {
  const s = VARIANT_STYLES[variant] || VARIANT_STYLES.action
  const Icon = s.icon
  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} px-3.5 py-2.5 w-full max-w-[15rem] ${className}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 ${s.iconColor} shrink-0 mt-0.5`} />
        <div className="min-w-0">
          <div className={`text-xs font-semibold leading-snug ${s.text}`}>{label}</div>
          {detail && <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{detail}</p>}
        </div>
      </div>
    </div>
  )
}

function HexCard({ label, detail, small = false }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`border-2 border-amber-500/50 bg-amber-500/10 flex items-center justify-center text-center ${small ? 'px-6 py-3 max-w-[16rem]' : 'px-8 py-4 max-w-lg'}`}
        style={{ clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)' }}
      >
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <Waypoints className={`${small ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-400 shrink-0`} />
            <span className={`font-semibold text-amber-200 ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
          </div>
          {detail && <p className="text-[11px] text-amber-300/70 leading-snug mt-1">{detail}</p>}
        </div>
      </div>
    </div>
  )
}

function EnrichmentRow({ nodes }) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-semibold mb-2">
        Enrichment &middot; parallel
      </div>
      <div className="border-t border-cyan-500/25 w-full max-w-3xl">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-4">
          {nodes.map((n, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-px h-3 bg-cyan-500/25" />
              <NodeCard {...n} variant="enrichment" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NotifyRow({ nodes }) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex flex-wrap justify-center gap-4">
        {nodes.map((n, i) => (
          <NodeCard key={i} {...n} variant="notify" />
        ))}
      </div>
    </div>
  )
}

function GateBlock({ label, detail, elseLabel }) {
  return (
    <div className="flex flex-col items-center">
      <HexCard label={label} detail={detail} small />
      {elseLabel && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-600">
          <CornerDownRight className="w-3 h-3 shrink-0" />
          <span>else &rarr; {elseLabel}</span>
        </div>
      )}
    </div>
  )
}

function ActionStack({ nodes }) {
  return (
    <div className="flex flex-col items-center gap-0">
      {nodes.map((n, i) => (
        <div key={i} className="flex flex-col items-center">
          {i > 0 && <div className="w-px h-4 bg-[#3a2465]" />}
          <NodeCard {...n} />
        </div>
      ))}
    </div>
  )
}

function BranchColumn({ branch, tone }) {
  const toneClass = tone === 'true'
    ? 'text-green-400 border-green-500/30 bg-green-500/5'
    : 'text-slate-400 border-slate-600/30 bg-white/5'
  return (
    <div className="flex flex-col items-center h-full">
      <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 border ${toneClass}`}>
        {tone === 'true' ? 'TRUE' : 'FALSE'}{branch.label ? ` · ${branch.label}` : ''}
      </span>
      <div className="w-px h-4 bg-[#3a2465] mt-1.5" />
      <div className="flex flex-col items-center gap-0">
        {branch.nodes.map((n, i) => (
          <div key={i} className="flex flex-col items-center">
            {i > 0 && <div className="w-px h-4 bg-[#3a2465]" />}
            <NodeCard {...n} />
          </div>
        ))}
      </div>
      {/* flexible stub so both columns reach a shared bottom border regardless of height */}
      <div className="w-px flex-1 bg-[#3a2465]/60 mt-1" style={{ minHeight: '1rem' }} />
    </div>
  )
}

function DecisionBlock({ label, detail, branches, converge }) {
  return (
    <div className="flex flex-col items-center w-full">
      <HexCard label={label} detail={detail} />
      <div className="w-px h-5 bg-amber-500/30" />
      <div className="border-t border-amber-500/30 w-full max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 pt-0 items-stretch">
          <BranchColumn branch={branches.true} tone="true" />
          <BranchColumn branch={branches.false} tone="false" />
        </div>
      </div>
      {converge && (
        <>
          <div className="border-b border-amber-500/30 w-full max-w-3xl" />
          <div className="w-px h-5 bg-amber-500/30" />
          <div className="text-[10px] uppercase tracking-wider text-amber-400/60 -mt-1">converge</div>
        </>
      )}
    </div>
  )
}

function Block({ block }) {
  switch (block.kind) {
    case 'trigger':
      return <TriggerCard {...block} />
    case 'enrichment':
      return <EnrichmentRow nodes={block.nodes} />
    case 'gate':
      return <GateBlock {...block} />
    case 'action':
      return <ActionStack nodes={block.nodes} />
    case 'decision':
      return <DecisionBlock {...block} />
    case 'notify':
      return <NotifyRow nodes={block.nodes} />
    default:
      return null
  }
}

export default function HAPlaybookDiagram({ diagram }) {
  if (!diagram || !diagram.blocks?.length) return null
  return (
    <div className="rounded-xl border border-[#2d1b4e] bg-[#12081f] p-5 overflow-x-auto">
      <div className="flex flex-col items-center gap-0 min-w-[520px] w-full">
        {diagram.blocks.map((block, i) => (
          <div key={i} className="flex flex-col items-center w-full">
            {i > 0 && <FlowConnector />}
            <Block block={block} />
          </div>
        ))}
      </div>
    </div>
  )
}
