import { NextResponse } from 'next/server'
import { listLocalRepositories } from '@/lib/repos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const repositories = await listLocalRepositories()
    return NextResponse.json({ repositories })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Unknown error' }, { status: 500 })
  }
}

/*
sudo podman run -d -v /home/reggie/Documents/code/devops/git-gui:/srv/repositories/git-gui --replace --pod controlplane_gitgui --name node_service_controlplane_gitgui_gitgui -w /srv/main -v /home/reggie/Documents/code/devops/git-gui:/srv/main docker.io/library/node:22-alpine sh -c 'apk add openssh sudo rsync bash npm bind-tools git && rm -rf node_modules && npm install && npm run dev';
*/