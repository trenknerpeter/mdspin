import { describe, it, expect, afterEach } from "vitest"
import { isAdminUser } from "../admin"

const ID = "8c274f2b-85b9-4e79-aa1c-f700dcfc2a04"
const OTHER = "412767bf-0000-0000-0000-000000000000"

function setEnv(value: string | undefined) {
  if (value === undefined) delete process.env.ADMIN_USER_IDS
  else process.env.ADMIN_USER_IDS = value
}

afterEach(() => setEnv(undefined))

describe("isAdminUser", () => {
  it("admits a listed id", () => {
    setEnv(ID)
    expect(isAdminUser(ID)).toBe(true)
  })

  it("admits an id from a comma-separated list, tolerating whitespace", () => {
    setEnv(` ${OTHER} , ${ID} `)
    expect(isAdminUser(ID)).toBe(true)
    expect(isAdminUser(OTHER)).toBe(true)
  })

  it("rejects an id that is not listed", () => {
    setEnv(ID)
    expect(isAdminUser(OTHER)).toBe(false)
  })

  // The failure modes that would leak every user's data if they defaulted open.
  it("fails closed when the variable is unset", () => {
    setEnv(undefined)
    expect(isAdminUser(ID)).toBe(false)
  })

  it("fails closed when the variable is empty or only separators", () => {
    setEnv("")
    expect(isAdminUser(ID)).toBe(false)
    setEnv("  ,  , ")
    expect(isAdminUser(ID)).toBe(false)
  })

  it("rejects a missing user id even when ids are configured", () => {
    setEnv(ID)
    expect(isAdminUser(undefined)).toBe(false)
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser("")).toBe(false)
  })
})
