import Debug from "debug"
import { DungeonId } from "./ms2/dungeonid.js"
import { fetchClearedByDate } from "./ms2/ms2fetch.js"


const debug = Debug("ms2:debug:testMain")
export async function testMain() {
  // 1. test date parsing
  const parsedHardRook = await fetchClearedByDate(DungeonId.HARD_ROOK, 3, true)
  // length should be 10
  assert(parsedHardRook.length === 10, "parsedHardRook.length == 10")
  // first time should be 844
  assert(parsedHardRook[0]?.clearSec === 844, "parsedHardRook[0]?.clearSec === 844")
  assert(parsedHardRook[5]?.clearSec === 660, "parsedHardRook[5]?.clearSec === 660")

  // debug(parsedHardRook[0])
  debug("Done!")
}

function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}