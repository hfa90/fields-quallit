import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { Empty } from '../components/ui'

export default function NotFound({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Empty icon={<SearchX className="size-8" />} title={message ?? 'Página não encontrada'}>
        <Link to="/" className="mt-3 inline-block font-semibold text-indigo-600 hover:underline">Voltar para a biblioteca</Link>
      </Empty>
    </div>
  )
}
