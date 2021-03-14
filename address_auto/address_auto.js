import areaList from "./area.json"

/**
 * @typedef {Object} ReturnInfo
 * @property {String} name - 名字
 * @property {String} tel - 电话
 * @property {String} province - 省份
 * @property {String} city - 城市
 * @property {String} county - 区县
 * @property {String} areaCode - 地区编码
 * @property {String} addressDetail - 详细地址
 */

/**
 * 收件人信息自动识别
 * @param {String} auto_value 输入的信息
 * @returns {ReturnInfo}
 */
function address_auto(auto_value) {
  /**
   * 储存分割后的数据
   * @type {String[]}
   */
  let split_res = [ auto_value ]

  /**
   * 支持的分割符
   * @type {string[]}
   */
  let splitters = [",", "，", " ", "\r\n", "\n"]

  // 按不同的分隔符依次分割
  for (let splitter of splitters) {
    let split_res1 = []
    for (let split_res_item of split_res) {
      split_res1.push(...split_res_item.split(splitter))
    }
    split_res = split_res1
  }

  // 类型标记
  // 后面会对每个分割后的部分进行类型检测
  let TYPE_MOBILE = 1 << 0          // 手机
  let TYPE_NAME = 1 << 1            // 名字
  let TYPE_ADDR_PROVINCE = 1 << 2   // 地址-省份部分
  let TYPE_ADDR_CITY = 1 << 3       // 地址-城市部分
  let TYPE_ADDR_COUNTY = 1 << 4     // 地址-区县部分
  let TYPE_ADDR_DETAIL = 1 << 5     // 地址-详细地址部分

  // 地址中可写可不写的部分
  let DISPENSIBLE_PROVINCES = [ "省", "市", "自治区" ]
  let DISPENSIBLE_CITYS = [ "市", "地区", "区", "盟", "自治州" ]
  let DISPENSIBLE_COUNTYS = [ "林区", "族区", "区", "自治县", "县", "市", "自治旗", "旗" ]

  /**
   * 储存地区信息的结构
   * @typedef {Object} AreaInfo
   * @property {String} code - 地区编码
   * @property {String} name - 地区名称
   * @property {String} name_except_dispensible - 除了dispensible部分后的地区名称
   * @property {Number} similarity - 匹配name_except_dispensible时的相似度
   */

  /**
   * 地区数据处理函数
   * @param {Object.<String, String>} data - 地区数据
   * @param {Array.<String>} dispensible_list - 可忽略的内容
   * @returns {Array.<AreaInfo>}}
   */
  let area_data_processing = function (data, dispensible_list) {
    return Object.entries(data).map(entry => {
      let item = {
        code: entry[0] + "",
        name: entry[1] + "",
        name_except_dispensible: entry[1] + "",
        similarity: 1,
      }
      for (let dispensible_item of dispensible_list) {
        if (item.name.endsWith(dispensible_item) && item.name.length >= dispensible_item.length + 2) {
          item.name_except_dispensible = item.name.substring(0, item.name.length - dispensible_item.length)
          item.similarity = item.name_except_dispensible.length / item.name.length
          break
        }
      }
      return item
    })
  }

  let provinces = area_data_processing(areaList.province_list, DISPENSIBLE_PROVINCES)   // 储存省份信息的数组
  let citys = area_data_processing(areaList.city_list, DISPENSIBLE_CITYS)               // 储存省份信息的数组
  let countys = area_data_processing(areaList.county_list, DISPENSIBLE_COUNTYS)         // 储存省份信息的数组

  /**
   * 匹配到的信息的结构
   * @typedef {Object} ResInfo
   * @property {String} code - 地区编码
   * @property {String} name - 地区名称
   * @property {Number} similarity - 相似度（完全匹配时为1）
   * @property {Number} split_res_index - 对应的split_res数组中的数据的索引
   * @property {String} [capture_province] - 捕获的省份内容，此字段只在省份信息内存在
   * @property {String} [capture_city] - 捕获的城市内容，此字段只在城市信息内存在
   * @property {String} [capture_county] - 捕获的区县内容，此字段只在区县信息内存在
   * @property {Number} [max_city_split_res_index] - 最大相似度的城市对应的split_res数组中的数据的索引，此字段只在最终结果中存在
   * @property {Number} [max_city_resInfo_index] - 最大相似度的城市对应的city_resInfo_list数组中的数据的索引，此字段只在最终结果中存在
   * @property {Number} [max_province_split_res_index] - 最大相似度的省份对应的split_res数组中的数据的索引，此字段只在最终结果中存在
   * @property {Number} [max_province_resInfo_index] - 最大相似度的省份对应的province_resInfo_list数组中的数据的索引，此字段只在最终结果中存在
   */

  /**
   * 储存匹配到的省份信息
   * @type {ResInfo[]}
   */
  let province_resInfo_list = []

  /**
   * 储存匹配到的城市信息
   * @type {ResInfo[]}
   */
  let city_resInfo_list = []

  /**
   * 储存匹配到的区县信息
   * @type {ResInfo[]}
   */
  let county_resInfo_list = []

  /**
   * 分割后的数据的扩展结构
   * @typedef {Object} SplitResEx
   * @property {String} value - 原始split_res数组内对应的元素
   * @property {Number} type - 类型标记
   */

  /**
   * 对split_res数组的数据进行处理后的拓展数据
   * @type {SplitResEx[]}
   */
  let split_res_ex = split_res
      .filter(split_res_item => split_res_item !== "")
      .map(split_res_item => {
        return {
          value: split_res_item,
          type: 0,
        }
      })

  // 用于匹配11位手机号的正则表达式
  let reg_exp_mobile = new RegExp("[0-9]{11}", "gmu")

  // 储存手机的识别结果
  let mobile = ""

  // 储存split_res_ex数组内识别到手机的元素的索引
  let mobile_split_res_index = -1

  // 开始识别，遍历split_res_ex
  for (let i = 0; i < split_res_ex.length; i++) {
    let split_res_item = split_res_ex[i]    // 当前遍历元素

    // 识别到手机（如果有多个，只储存最后一个）
    if (reg_exp_mobile.test(split_res_item.value)) {
      split_res_item.type |= TYPE_MOBILE    // 标记类型
      mobile = split_res_item.value         // 储存识别结果
      mobile_split_res_index = i            // 储存对应索引
    }

    // 对每个split_res_ex元素遍历识别所有的省份、城市、区县
    // 构建[省份、城市、区县]遍历结构
    let loop_data = [
      { data: provinces, type: TYPE_ADDR_PROVINCE, resInfo_list: province_resInfo_list, type_name: "province" },
      { data: citys, type: TYPE_ADDR_CITY, resInfo_list: city_resInfo_list, type_name: "city" },
      { data: countys, type: TYPE_ADDR_COUNTY, resInfo_list: county_resInfo_list, type_name: "county" },
    ]

    // 遍历[省份、城市、区县]
    for (let j = 0; j < 3; j++) {

      // 遍历（省份）或（城市）或（区县）
      for (let item of loop_data[j].data) {
        let similarity = undefined      // 相似度
        let capture_value = undefined   // 储存捕获到的名称

        // 完整匹配某个（省份）或（城市）或（区县）的名称
        if (split_res_item.value.search(item.name) !== -1) {
          similarity = 1            // 相似度为1
          capture_value = item.name   // 储存完整名称
        }
        // 非完整匹配某个（省份）或（城市）或（区县）的名称
        else if (split_res_item.value.search(item.name_except_dispensible) !== -1) {
          similarity = item.similarity      // 储存相似度（前面已计算）
          capture_value = item.name_except_dispensible   // 储存省略后的名称
        }

        // 成功匹配，储存信息
        if (similarity !== undefined) {
          loop_data[j].resInfo_list.push({
            code: item.code,
            name: item.name,
            similarity: similarity,
            split_res_index: i,
            [`capture_${loop_data[j].type_name}`]: capture_value
          })
        }
      }
    }
  }

  // 由区县的匹配结果决定地址信息最终是否匹配成功
  // 只要区县匹配成功，不论城市和省份是否匹配成功，最终都将按匹配成功处理
  // 下面的处理主要是针对匹配到多个区县的情况，最终按叠加的相似度决定匹配结果
  // 因为该步骤主要是为了消除误判的区县，所以区县所属的城市和省份被匹配时，权重分别是10倍和100倍
  if (county_resInfo_list.length >= 1) {

    // 遍历区县的匹配结果
    for (let i = 0; i < county_resInfo_list.length; i++) {
      let county_resInfo_item = county_resInfo_list[i]    // 本次遍历的区县元素
      let add_similarity = 0    // 最后要叠加到区县结果内的相似度

      // 遍历城市的匹配结果
      for (let j = 0; j < city_resInfo_list.length; j++) {
        // 若匹配成功的区县其所属的城市同时也匹配成功，则记录其相似度
        if (city_resInfo_list[j].code.substring(0, 4) === county_resInfo_item.code.substring(0, 4)) {
          // 被匹配的区县所属的城市可能会匹配到多个，所以要找出其中相似度最大的
          if (city_resInfo_list[j].similarity > add_similarity) {
            add_similarity = city_resInfo_list[j].similarity
          }
        }
      }
      county_resInfo_item.similarity += add_similarity * 10     // 在城市的相似度的基础上乘10

      // 遍历省份的匹配结果（同上）
      add_similarity = 0
      for (let j = 0; j < province_resInfo_list.length; j++) {
        if (province_resInfo_list[j].code.substring(0, 2) === county_resInfo_item.code.substring(0, 2)) {
          if (province_resInfo_list[j].similarity > add_similarity) {
            add_similarity = province_resInfo_list[j].similarity
          }
        }
      }
      county_resInfo_item.similarity += add_similarity * 100    // 在省份的相似度的基础上乘10
    }

    // 按叠加后的相似度对区县的匹配结果进行排序，从大到小
    county_resInfo_list.sort((item0, item1) => item1.similarity - item0.similarity)

    // 排序后的区县匹配结果中的第一个元素视作最终匹配元素
    let matching_county = county_resInfo_list[0]

    // 在对应的split_res_ex数组内的数据上加上区县地址匹配标记
    split_res_ex[matching_county.split_res_index].type |= TYPE_ADDR_COUNTY

    // 在城市匹配结果中寻找最终匹配的区县所属的城市
    let max_similarity = 0        // 临时变量，记录当前已遍历的匹配城市中相似度最大的
    let max_resInfo_index = -1    // 相似度最大的城市在city_resInfo_list数组中对应的索引
    for (let i = 0; i < city_resInfo_list.length; i++) {
      if (city_resInfo_list[i].code.substring(0, 4) === matching_county.code.substring(0, 4)) {
        if (city_resInfo_list[i].similarity > max_similarity) {
          max_similarity = city_resInfo_list[i].similarity
          max_resInfo_index = i
        }
      }
    }
    // 若寻找到相应的匹配城市，则储存和设置对应的信息
    if (max_resInfo_index !== -1) {
      matching_county.max_city_split_res_index = city_resInfo_list[max_resInfo_index].split_res_index
      matching_county.max_city_resInfo_index = max_resInfo_index
      split_res_ex[city_resInfo_list[max_resInfo_index].split_res_index].type |= TYPE_ADDR_CITY
    }

    // 在省份匹配结果中寻找最终匹配的区县所属的省份，同上
    max_similarity = 0
    max_resInfo_index = -1
    for (let i = 0; i < province_resInfo_list.length; i++) {
      if (province_resInfo_list[i].code.substring(0, 2) === matching_county.code.substring(0, 2)) {
        if (province_resInfo_list[i].similarity > max_similarity) {
          max_similarity = province_resInfo_list[i].similarity
          max_resInfo_index = i
        }
      }
    }
    if (max_resInfo_index !== -1) {
      matching_county.max_province_split_res_index = province_resInfo_list[max_resInfo_index].split_res_index
      matching_county.max_province_resInfo_index = max_resInfo_index
      split_res_ex[province_resInfo_list[max_resInfo_index].split_res_index].type |= TYPE_ADDR_PROVINCE
    }
  }

  // 储存名字的识别结果
  let name = ""
  // split_res_ex数组中还未匹配到任何类型的元素
  let split_res_type_equal_0 = []
  // 遍历split_res_ex数组，寻找还未匹配到任何类型的元素
  for (let i =0; i < split_res_ex.length; i++) {
    if (split_res_ex[i].type === 0) {
      split_res_type_equal_0.push({
        split_res_item: split_res_ex[i],
        index: i
      })
    }
  }

  // 按内容的长度排序，从小到大
  split_res_type_equal_0.sort((item0, item1) =>
      item0.split_res_item.value.length - item1.split_res_item.value.length
  )

  // 遍历排序后的split_res_type_equal_0数组（split_res_type_equal_0数组中除了可能存在名字外，还可能存在"详细地址"）
  // 规则1：名字不会被除手机外的其他信息包裹在中间，既除手机外，名字应该在两端
  // 规则2：名字不会比"详细地址"长
  for (let i = 0; i < split_res_type_equal_0.length; i++) {
    let item = split_res_type_equal_0[i].split_res_item   // 对应的split_res_item数组的元素
    let index = split_res_type_equal_0[i].index           // 对应的split_res_item数组的元素的索引
    let access_indexs;    // 储存特定情况下，名字所有可能出现的位置（名字应该在两端）

    // 若未匹配到手机，则名字应该在两端，否则，名字应该在除了手机所在位置后的两端
    if (mobile_split_res_index === 0) {
      access_indexs = [1, split_res_ex.length - 1]
    }
    else if (mobile_split_res_index === split_res_ex.length - 1) {
      access_indexs = [0, split_res_ex.length - 2]
    }
    else {
      access_indexs = [0, split_res_ex.length - 1]
    }

    // 匹配
    if (access_indexs.indexOf(index) !== -1) {
      // 若split_res_type_equal_0内不止一个元素，说明split_res_type_equal_0内存在"详细地址"部分
      if (split_res_type_equal_0.length > 1) {
        let add_length = 0    // 储存除本元素外的其他元素的内容长度的累加值

        // 累加其他部分
        for (let j = 0; j < i; j++) {
          add_length += split_res_type_equal_0[j].split_res_item.value.length
        }
        for (let j = i + 1; j < split_res_type_equal_0.length; j++) {
          add_length += split_res_type_equal_0[j].split_res_item.value.length
        }

        // 若本元素长度小于其他元素的长度累加值，则判定本元素为名字
        if (item.value.length < add_length) {
          item.type |= TYPE_NAME
          name = item.value
          break
        }
      }
      // 若split_res_type_equal_0内只有一个元素，则判定本元素为名字
      else{
        item.type |= TYPE_NAME
        name = item.value
        break
      }
    }
  }

  let province = ""   // 储存省份的识别结果
  let city = ""       // 储存城市的识别结果
  let county = ""     // 储存区县的识别结果
  let code = ""       // 储存地区编码的识别结果
  let detail = ""     // 储存详细地址的识别结果

  // 若有识别到区县地址
  if (county_resInfo_list.length > 0) {
    let matching_county = county_resInfo_list[0]    // 最终匹配元素

    let detail_join_index_list = []   // 储存详细地址的各个部分对应的split_res_ex数组元素的索引

    // 若有匹配到的省份
    if (matching_county.hasOwnProperty("max_province_split_res_index")) {
      detail_join_index_list.push(matching_county.max_province_split_res_index)
      province = province_resInfo_list[matching_county.max_province_resInfo_index].name
    }
    else {
      province = areaList.province_list[matching_county.code.substring(0, 2) + "0000"]
    }

    // 若有匹配到的城市
    if (matching_county.hasOwnProperty("max_city_split_res_index")) {
      // 检测是否与匹配到的省份对应的split_res_ex数组元素的索引重复，不重复才添加
      if (detail_join_index_list.indexOf(matching_county.max_city_split_res_index) === -1) {
        detail_join_index_list.push(matching_county.max_city_split_res_index)
      }
      city = city_resInfo_list[matching_county.max_city_resInfo_index].name
    }
    else {
      city = areaList.city_list[matching_county.code.substring(0, 4) + "00"]
    }

    // 检测是否与匹配到的省份及城市对应的split_res_ex数组元素的索引重复，不重复才添加
    if (detail_join_index_list.indexOf(matching_county.split_res_index) === -1) {
      detail_join_index_list.push(matching_county.split_res_index)
    }
    county = matching_county.name

    code = matching_county.code

    // 将其余未匹配到任何类型的元素判定为"详细地址"部分，添加其对应的split_res_ex数组元素的索引到detail_join_index_list数组
    for (let i = 0; i < split_res_ex.length; i++) {
      if (split_res_ex[i].type === 0) {
        detail_join_index_list.push(i)
      }
    }

    // 拼接detail_join_index_list数组内所有元素对应的split_res_ex数组元素的内容
    detail = detail_join_index_list.map(i => split_res_ex[i].value).join("")
    // 去除省份信息
    if (matching_county.hasOwnProperty("max_province_resInfo_index")) {
      detail = detail.replace(province_resInfo_list[matching_county.max_province_resInfo_index].capture_province, "")
    }
    // 去除城市信息
    if (matching_county.hasOwnProperty("max_city_resInfo_index")) {
      detail = detail.replace(city_resInfo_list[matching_county.max_city_resInfo_index].capture_city, "")
    }
    // 去除区县信息
    detail = detail.replace(matching_county.capture_county, "")
  }

  return {
    name: name,
    tel: mobile,
    province: province,
    city: city,
    county: county,
    areaCode: code,
    addressDetail: detail,
  }
}

export default address_auto
