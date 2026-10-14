export const clothingTypes = ['tops','shirts','knit','hoodie','jacket','trousers','shorts','panjabi','dresses','salwar','saree','underwear'] as const
export type ClothingType = typeof clothingTypes[number]
export type SizeRange = 'men'|'women'|'kids'|'baby'
type Range = readonly [number,number]
export type SizeRow = { size:string; chest?:Range; waist?:Range; hip?:Range; height?:Range; months?:Range }
// Approximate reference body circumferences in inches. These are not garment specifications.
const adult = (size:string,chest:Range,waist:Range,hip:Range):SizeRow=>({size,chest,waist,hip})
export const adultCharts:Record<'men'|'women',SizeRow[]> = {
  men:[adult('XS',[34,36],[28,30],[34,36]),adult('S',[36,38],[30,32],[36,38]),adult('M',[38,40],[32,34],[38,40]),adult('L',[40,42],[34,36],[40,42]),adult('XL',[42,44],[36,38],[42,44]),adult('2XL',[44,46],[38,40],[44,46]),adult('3XL',[46,48],[40,42],[46,48])],
  women:[adult('XS',[30,32],[24,26],[33,35]),adult('S',[32,34],[26,28],[35,37]),adult('M',[34,36],[28,30],[37,39]),adult('L',[36,39],[30,33],[39,42]),adult('XL',[39,42],[33,36],[42,45]),adult('2XL',[42,45],[36,39],[45,48]),adult('3XL',[45,48],[39,42],[48,51])],
}
// Height-based children's labels; centimetres, with indicative age in months.
export const childCharts:Record<'kids'|'baby',SizeRow[]> = {
  kids:[{size:'92',height:[86,92],months:[18,24]},{size:'104',height:[98,104],months:[36,48]},{size:'116',height:[110,116],months:[60,72]},{size:'128',height:[122,128],months:[84,96]},{size:'140',height:[134,140],months:[108,120]},{size:'152',height:[146,152],months:[132,144]},{size:'164',height:[158,164],months:[156,168]}],
  baby:[{size:'56',height:[50,56],months:[0,1]},{size:'62',height:[56,62],months:[1,3]},{size:'68',height:[62,68],months:[3,6]},{size:'74',height:[68,74],months:[6,9]},{size:'80',height:[74,80],months:[9,12]},{size:'86',height:[80,86],months:[12,18]}],
}
export function suggestedClothing(value:string):ClothingType {
  const source=value.toLowerCase()
  if(/t-?shirt|polo/.test(source))return 'tops'
  if(/panjabi|punjabi|kurta/.test(source))return 'panjabi'
  if(/salwar|kameez/.test(source))return 'salwar'
  if(/saree|sari|unstitched/.test(source))return 'saree'
  if(/hoodie|sweatshirt/.test(source))return 'hoodie'
  if(/jacket|coat|blazer/.test(source))return 'jacket'
  if(/short/.test(source))return 'shorts'
  if(/trouser|jean|pant/.test(source))return 'trousers'
  if(/dress|skirt/.test(source))return 'dresses'
  if(/shirt|blouse/.test(source))return 'shirts'
  if(/knit|sweater/.test(source))return 'knit'
  if(/underwear|sleepwear|pyjama|pajama/.test(source))return 'underwear'
  return 'tops'
}
