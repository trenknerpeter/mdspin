import { describe, it, expect } from "vitest"
import { hashIp } from "@/lib/rate-limit"

describe("hashIp", () => {
  it("is deterministic per key so a guest's counter is found again", () => {
    expect(hashIp("203.0.113.7", "k1")).toBe(hashIp("203.0.113.7", "k1"))
  })
  it("never contains the raw IP and matches the shape prune_guest_usage keeps", () => {
    for (const ip of ["203.0.113.7", "2001:db8::1", "127.0.0.1"]) {
      const h = hashIp(ip, "k1")
      expect(h).toMatch(/^[0-9a-f]{64}$/)
      expect(h).not.toContain(ip)
    }
  })
  it("depends on the key, so the table alone can't be brute-forced back to IPs", () => {
    expect(hashIp("203.0.113.7", "k1")).not.toBe(hashIp("203.0.113.7", "k2"))
  })
})
