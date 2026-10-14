import { Component, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { Button, EmptyState } from './ui'

type Props = { children: ReactNode; title: string; description: string; action: string }
class RecoveryBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="container experience-recovery" role="alert"><EmptyState title={this.props.title} description={this.props.description} action={<Button type="button" onClick={() => window.location.reload()}>{this.props.action}</Button>} /></section>
  }
}

export function ExperienceBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return <RecoveryBoundary title={t('delight.recoveryTitle')} description={t('delight.recoveryHelp')} action={t('delight.refresh')}>{children}</RecoveryBoundary>
}
