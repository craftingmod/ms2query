import { fetchCapsuleList } from "./ms2/ms2fetch.js"
import Debug from "debug"
import { MS2CapsuleSimulator } from "./ms2/ms2gatcha.js"
import fs from "node:fs/promises"

const debug = Debug("ms2:debug:main")

const weddingFullset = ["로맨틱 웨딩 펄 이어링 (여)", "로맨틱 웨딩 티아라 (여)", "로맨틱 웨딩 펄 글러브 (여)", "로맨틱 웨딩 펄 슈즈 (여)", "로맨틱 웨딩 파티 벌룬 (여)", "로맨틱 웨딩 드레스 (여)"]
const pumpkinFullset = ["펌킨 위치 미니 햇 (여)", "펌킨 위치 링 (여)", "펌킨 위치 슈즈 (여)", "펌킨 위치 윙 (여)"]
const darknessFullset = ["로열 다크니스 이어링 (여)", "로열 다크니스 헤일로 (여)", "로열 다크니스 글러브 (여)", "로열 다크니스 부츠 (여)", "로열 다크니스 페더 윙 (여)", "로열 다크니스 드레스 (여)"]
const darkmoonFullset = ["다크문 키튼 귀고리 (여)", "다크문 키튼 모자 (여)", "다크문 키튼 장갑 (여)", "다크문 키튼 신발 (여)", "다크문 키튼 망토 (여)", "다크문 키튼 전신 (여)"]
const weapons = ["로맨틱 웨딩 웨폰 박스", "블러디 데빌 웨폰 박스", "할로윈 웨폰 박스"]

const gatcha = new MS2CapsuleSimulator()
await gatcha.loadTable(313922)

const target50 = [...weddingFullset].map((v) => ({ itemName: v, coin: 50 }))
const target40 = [...darkmoonFullset].map((v) => ({ itemName: v, coin: 40 }))

let result: number[] = []
for (let i = 0; i < 100000; i += 1) {
  const simulate = gatcha.simulateUntilGet([...target50], (item) => {
    if (item.itemName === "로맨틱 웨딩 룩 패키지") {
      return weddingFullset
    } else if (item.itemName === "펌킨 위치 룩 패키지") {
      return pumpkinFullset
    } else if (item.itemName === "로열 다크니스 룩 패키지") {
      return darknessFullset
    }
    return null
  })
  result.push(simulate.length * 200)
}

await fs.writeFile("result.csv", `usedMeret\n${result.join("\n")}`)