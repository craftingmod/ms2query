import { fetchClearedByDate, fetchClearedRate, fetchMainCharacterByName, fetchTrophyCount } from "./ms2/ms2fetch"
import { DungeonId } from "./ms2/dungeonid"

console.log("Hello World!")

async function main() {
  // const result = await fetchClearedByDate(DungeonId.HARD_LUKE, 1)
  // console.log(result)
  const rate = await fetchClearedRate(DungeonId.REVERSE_ZAKUM, "팬요")
  console.log(rate)
  const trophy = await fetchTrophyCount("팬요")
  console.log(trophy)

  const mainChar = await fetchMainCharacterByName("팬요", 2022, 1)
  console.log(mainChar)

  console.log("Done!")
}

try {
  main()
} catch (err) {
  console.error(err)
}