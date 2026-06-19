import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function GET() {
  const dataDir = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'reflections-local')
    : path.join(os.tmpdir(), 'reflections-local')
  const dbFile = path.join(dataDir, 'reflections-db.json')

  let fileExists = false
  let fileSize = 0
  let parseError = ''
  let participants: any[] = []
  let schools: any[] = []
  let users: any[] = []
  let settings: any = null

  try {
    const stat = fs.statSync(dbFile)
    fileExists = true
    fileSize = stat.size
    const raw = fs.readFileSync(dbFile, 'utf8')
    const store = JSON.parse(raw)
    participants = store.participants ?? []
    schools = store.schools ?? []
    settings = store.settings ?? null
    // omit passwords
    users = (store.users ?? []).map((u: any) => ({ id: u.id, email: u.email, role: u.role, slot_number: u.slot_number }))
  } catch (e: any) {
    parseError = e?.message ?? 'unknown error'
  }

  // test write
  let writeTest = 'ok'
  try {
    const tmp = dbFile + '.writetest'
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(tmp, 'test')
    fs.unlinkSync(tmp)
  } catch (e: any) {
    writeTest = `FAILED: ${e?.message}`
  }

  return NextResponse.json({
    dbFile,
    fileExists,
    fileSize,
    participantCount: participants.length,
    parseError: parseError || null,
    writeTest,
    settings,
    schools,
    users,
    participants,
    APPDATA: process.env.APPDATA ?? '(not set)',
  })
}
