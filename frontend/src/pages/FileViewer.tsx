import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getProject, projectFileDownloadUrl } from '../api'
import type { Project, ProjectFile } from '../types'
import { AppCard, Button, ErrorState, LoadingState, PageIntro } from '../components/ui'
import { formatDate, formatFileSize } from '../lib/format'

export default function FileViewer() {
  const navigate = useNavigate()
  const { projectId: projectIdParam, fileId: fileIdParam } = useParams()
  const projectId = Number(projectIdParam)
  const fileId = Number(fileIdParam)

  const [project, setProject] = useState<Project | null>(null)
  const [file, setFile] = useState<ProjectFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(projectId) || !Number.isFinite(fileId)) {
      setError('Invalid project or file id.')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const p = await getProject(projectId)
        const f = p.files.find(x => x.id === fileId)
        if (!f) {
          setError(`File ${fileId} not found in project ${projectId}.`)
        } else {
          setProject(p)
          setFile(f)
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to load.')
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId, fileId])

  if (loading) return <LoadingState label="Loading file" />
  if (error || !project || !file) return <ErrorState message={error ?? 'Not found.'} onRetry={() => navigate(`/projects/${projectId}`)} />

  const inlineUrl = projectFileDownloadUrl(projectId, fileId, true)
  const downloadUrl = projectFileDownloadUrl(projectId, fileId, false)
  const isImage = file.contentType.startsWith('image/')
  const isPdf = file.contentType === 'application/pdf' || file.originalFilename.toLowerCase().endsWith('.pdf')

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-slate-300 transition-colors">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-slate-300 transition-colors">{project.projectName}</Link>
        <span>/</span>
        <span className="text-slate-300">{file.originalFilename}</span>
      </div>

      <PageIntro
        title={file.originalFilename}
        description={`${formatFileSize(file.sizeBytes)} · uploaded ${formatDate(file.uploadedAt)} · ${project.projectName}`}
        action={(
          <div className="flex gap-2">
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary">Download</Button>
            </a>
            <Link to={`/projects/${projectId}`}>
              <Button variant="ghost">Back to project</Button>
            </Link>
          </div>
        )}
      />

      <AppCard className="overflow-hidden">
        {isPdf && (
          <iframe
            src={inlineUrl}
            className="block w-full h-[calc(100vh-220px)]"
            title={file.originalFilename}
          />
        )}
        {isImage && (
          <div className="flex items-center justify-center bg-slate-950 p-4">
            <img src={inlineUrl} alt={file.originalFilename} className="max-h-[calc(100vh-260px)] max-w-full rounded" />
          </div>
        )}
        {!isPdf && !isImage && (
          <div className="p-8 text-center text-sm text-slate-400">
            <p>This file type can't be previewed in the browser.</p>
            <p className="mt-2">
              <a href={downloadUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Download {file.originalFilename}</a> to view it.
            </p>
          </div>
        )}
      </AppCard>
    </div>
  )
}
