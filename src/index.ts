import { fetchClearedByFirst } from "./ms2/ms2fetch"
import { DungeonId } from "./ms2/dungeonid"

console.log("Hello World!")

async function main() {
  const result = await fetchClearedByFirst(DungeonId.HARD_LUKE, 1)
  console.log(result)

  console.log("Done!")
}

main()