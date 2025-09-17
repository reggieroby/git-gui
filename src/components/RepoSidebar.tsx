"use client"

type Props = {
  selected: SectionId
  onSelect: (id: SectionId) => void
}

export type SectionId = 'file-status' | 'history' | 'branches' | 'tags' | 'stashes'

export default function RepoSidebar({ selected, onSelect }: Props) {
  const items: { id: SectionId; label: string }[] = [
    { id: 'file-status', label: 'File Status' },
    { id: 'history', label: 'History' },
    { id: 'branches', label: 'Branches' },
    { id: 'tags', label: 'Tags' },
    { id: 'stashes', label: 'Stashes' }
  ]

  return (
    <nav aria-label="Repository sections" className="repo-sidebar">
      <div className="repo-sidebar__header">Repository</div>
      <ul className="repo-sidebar__list">
        {items.map((it) => {
          const active = selected === it.id
          return (
            <li
              key={it.id}
              className={`repo-sidebar__item${active ? ' repo-sidebar__item--active' : ''}`}
            >
              <button
                type="button"
                className="repo-sidebar__button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(it.id)}
              >
                {it.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
