import type { Card } from '../content/schema'
import { BlankView } from './BlankView'
import { ChoiceView } from './ChoiceView'
import { CodeView } from './CodeView'
import { ExplainView } from './ExplainView'
import { LearnView } from './LearnView'
import { ParsonsView } from './ParsonsView'
import { ProjectView } from './ProjectView'
import type { ViewProps } from './types'

/** Picks the right view for a card. */
export function ExerciseView(props: ViewProps<Card>) {
  const { card } = props
  switch (card.type) {
    case 'learn':
      return <LearnView card={card} />
    case 'choice':
      return <ChoiceView {...props} card={card} />
    case 'parsons':
      return <ParsonsView {...props} card={card} />
    case 'blank':
      return <BlankView {...props} card={card} />
    case 'fix':
    case 'write':
      return <CodeView {...props} card={card} />
    case 'explain':
      return <ExplainView {...props} card={card} />
    case 'project':
      return <ProjectView {...props} card={card} />
  }
}
