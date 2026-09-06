// ==========================================
// 全国省份与地级市拼音转中文映射模块
// ==========================================

export const PROVINCES = [
  '陕西', '山西', '山东', '河南', '河北', '湖南', '湖北', '广东', '广西', 
  '四川', '浙江', '江苏', '福建', '辽宁', '吉林', '黑龙江', '云南', '贵州', 
  '甘肃', '青海', '内蒙古', '新疆', '西藏', '海南', '宁夏', '江西', '安徽', '台湾'
];

export const PINYIN_PROVINCE_MAP = {
  'Shanxi': '山西', 'Shaanxi': '陕西', 'Shandong': '山东', 'Henan': '河南', 'Hebei': '河北',
  'Hunan': '湖南', 'Hubei': '湖北', 'Guangdong': '广东', 'Guangxi': '广西', 'Sichuan': '四川',
  'Zhejiang': '浙江', 'Jiangsu': '江苏', 'Fujian': '福建', 'Liaoning': '辽宁', 'Jilin': '吉林',
  'Heilongjiang': '黑龙江', 'Yunnan': '云南', 'Guizhou': '贵州', 'Gansu': '甘肃', 'Qinghai': '青海',
  'Neimenggu': '内蒙古', 'InnerMongolia': '内蒙古', 'Xinjiang': '新疆', 'Xizang': '西藏', 'Tibet': '西藏',
  'Hainan': '海南', 'Ningxia': '宁夏', 'Jiangxi': '江西', 'Anhui': '安徽', 'Taiwan': '台湾',
  'Shanghai': '上海', 'Beijing': '北京', 'Tianjin': '天津', 'Chongqing': '重庆'
};

// 全国所有地级市拼音映射字典
export const PINYIN_CITY_MAP = {
  // 河南
  'Zhengzhou': '郑州', 'Kaifeng': '开封', 'Luoyang': '洛阳', 'Pingdingshan': '平顶山', 'Anyang': '安阳', 'Hebi': '鹤壁', 'Xinxiang': '新乡', 'Jiaozuo': '焦作', 'Puyang': '濮阳', 'Xuchang': '许昌', 'Luohe': '漯河', 'Sanmenxia': '三门峡', 'Nanyang': '南阳', 'Shangqiu': '商丘', 'Xinyang': '信阳', 'Zhoukou': '周口', 'Zhumadian': '驻马店',
  // 湖南
  'Changsha': '长沙', 'Zhuzhou': '株洲', 'Xiangtan': '湘潭', 'Hengyang': '衡阳', 'Shaoyang': '邵阳', 'Yueyang': '岳阳', 'Changde': '常德', 'Zhangjiajie': '张家界', 'Yiyang': '益阳', 'Chenzhou': '郴州', 'Yongzhou': '永州', 'Huaihua': '怀化', 'Loudi': '娄底',
  // 山西
  'Taiyuan': '太原', 'Datong': '大同', 'Yangquan': '阳泉', 'Changzhi': '长治', 'Jincheng': '晋城', 'Shuozhou': '朔州', 'Jinzhong': '晋中', 'Yuncheng': '运城', 'Xinzhou': '忻州', 'Linfen': '临汾', 'Luliang': '吕梁',
  // 陕西
  'Xian': '西安', 'Tongchuan': '铜川', 'Baoji': '宝鸡', 'Xianyang': '咸阳', 'Weinan': '渭南', 'Yanan': '延安', 'Hanzhong': '汉中', 'Yulin': '榆林', 'Ankang': '安康', 'Shangluo': '商洛',
  // 广东
  'Guangzhou': '广州', 'Shenzhen': '深圳', 'Zhuhai': '珠海', 'Shantou': '汕头', 'Foshan': '佛山', 'Shaoguan': '韶关', 'Zhanjiang': '湛江', 'Zhaoqing': '肇庆', 'Jiangmen': '江门', 'Maoming': '茂名', 'Huizhou': '惠州', 'Meizhou': '梅州', 'Shanwei': '汕尾', 'Heyuan': '河源', 'Yangjiang': '阳江', 'Qingyuan': '清远', 'Dongguan': '东莞', 'Zhongshan': '中山', 'Chaozhou': '潮州', 'Jieyang': '揭阳', 'Yunfu': '云浮',
  // 浙江
  'Hangzhou': '杭州', 'Ningbo': '宁波', 'Wenzhou': '温州', 'Jiaxing': '嘉兴', 'Huzhou': '湖州', 'Shaoxing': '绍兴', 'Jinhua': '金华', 'Quzhou': '衢州', 'Zhoushan': '舟山', 'Taizhou': '台州', 'Lishui': '丽水',
  // 江苏
  'Nanjing': '南京', 'Wuxi': '无锡', 'Xuzhou': '徐州', 'Changzhou': '常州', 'Suzhou': '苏州', 'Nantong': '南通', 'Lianyungang': '连云港', 'Huaiand': '淮安', 'Yancheng': '盐城', 'Yangzhou': '扬州', 'Zhenjiang': '镇江', 'Suqian': '宿迁',
  // 山东
  'Jinan': '济南', 'Qingdao': '青岛', 'Zibo': '淄博', 'Zaozhuang': '枣庄', 'Dongying': '东营', 'Yantai': '烟台', 'Weifang': '潍坊', 'Jining': '济宁', 'Taian': '泰安', 'Weihai': '威海', 'Rizhao': '日照', 'Linyi': '临沂', 'Dezhou': '德州', 'Liaocheng': '聊城', 'Binzhou': '滨州', 'Heze': '菏泽',
  // 四川
  'Chengdu': '成都', 'Zigong': '自贡', 'Panzhihua': '攀枝花', 'Luzhou': '泸州', 'Deyang': '德阳', 'Mianyang': '绵阳', 'Guangyuan': '广元', 'Suining': '遂宁', 'Neijiang': '内江', 'Leshan': '乐山', 'Nanchong': '南充', 'Meishan': '眉山', 'Yibin': '宜宾', 'Guangan': '广安', 'Dazhou': '达州', 'Yaan': '雅安', 'Bazhong': '巴中', 'Ziyang': '资阳',
  // 江西
  'Nanchang': '南昌', 'Jingdezhen': '景德镇', 'Pingxiang': '萍乡', 'Jiujiang': '九江', 'Xinyu': '新余', 'Yingtan': '鹰潭', 'Ganzhou': '赣州', 'Jian': '吉安', 'Yichun': '宜春', 'Fuzhou': '抚州', 'Shangrao': '上饶',
  // 湖北
  'Wuhan': '武汉', 'Huangshi': '黄石', 'Shiyan': '十堰', 'Yichang': '宜昌', 'Xiangyang': '襄阳', 'Ezhou': '鄂州', 'Jingmen': '荆门', 'Xiaogan': '孝感', 'Jingzhou': '荆州', 'Huanggang': '黄冈', 'Xianning': '咸宁', 'Suizhou': '随州',
  // 安徽
  'Hefei': '合肥', 'Wuhu': '芜湖', 'Bengbu': '蚌埠', 'Huainan': '淮南', 'Maanshan': '马鞍山', 'Huaibei': '淮北', 'Tongling': '铜陵', 'Anqing': '安庆', 'Huangshan': '黄山', 'Chuzhou': '滁州', 'Fuyang': '阜阳', 'Suzhou': '宿州', 'Luan': '六安', 'Bozhou': '亳州', 'Chizhou': '池州', 'Xuancheng': '宣城',
  // 福建
  'Fuzhou': '福州', 'Xiamen': '厦门', 'Putian': '莆田', 'Sanming': '三明', 'Quanzhou': '泉州', 'Zhangzhou': '漳州', 'Nanping': '南平', 'Longyan': '龙岩', 'Ningde': '宁德',
  // 河北
  'Shijiazhuang': '石家庄', 'Tangshan': '唐山', 'Qinhuangdao': '秦皇岛', 'Handan': '邯郸', 'Xingtai': '邢台', 'Baoding': '保定', 'Zhangjiakou': '张家口', 'Chengde': '承德', 'Cangzhou': '沧州', 'Langfang': '廊坊', 'Hengshui': '衡水',
  // 辽宁
  'Shenyang': '沈阳', 'Dalian': '大连', 'Anshan': '鞍山', 'Fushun': '抚顺', 'Benxi': '本溪', 'Dandong': '丹东', 'Jinzhou': '锦州', 'Yingkou': '营口', 'Fuxin': '阜新', 'Liaoyang': '辽阳', 'Panjin': '盘锦', 'Tieling': '铁岭', 'Chaoyang': '朝阳', 'Huludao': '葫芦岛',
  // 黑龙江
  'Harbin': '哈尔滨', 'Qiqihar': '齐齐哈尔', 'Jixi': '鸡西', 'Hegang': '鹤岗', 'Shuangyashan': '双鸭山', 'Daqing': '大庆', 'Yichun': '伊春', 'Jiamusi': '佳木斯', 'Qitaihe': '七台河', 'Mudanjiang': '牡丹江', 'Heihe': '黑河', 'Suihua': '绥化',
  // 吉林
  'Changchun': '长春', 'Jilin': '吉林', 'Siping': '四平', 'Liaoyuan': '辽源', 'Tonghua': '通化', 'Baishan': '白山', 'Songyuan': '松原', 'Baicheng': '白城',
  // 云南
  'Kunming': '昆明', 'Qujing': '曲靖', 'Yuxi': '玉溪', 'Baoshan': '保山', 'Zhaotong': '昭通', 'Lijiang': '丽江', 'Puer': '普洱', 'Lincang': '临沧',
  // 贵州
  'Guiyang': '贵阳', 'Liupanshui': '六盘水', 'Zunyi': '遵义', 'Anshun': '安顺', 'Bijie': '毕节', 'Tongren': '铜仁',
  // 甘肃
  'Lanzhou': '兰州', 'Jiayuguan': '嘉峪关', 'Jinchang': '金昌', 'Baiyin': '白银', 'Tianshui': '天水', 'Wuwei': '武威', 'Zhangye': '张掖', 'Pingliang': '平凉', 'Jiuquan': '酒泉', 'Qingyang': '庆阳', 'Dingxi': '定西', 'Longnan': '陇南',
  // 海南
  'Haikou': '海口', 'Sanya': '三亚', 'Sansha': '三沙', 'Danzhou': '儋州', 'Qionghai': '琼海', 'Wanning': '万宁', 'Wenchang': '文昌',
  // 广西
  'Nanning': '南宁', 'Guilin': '桂林', 'Liuzhou': '柳州', 'Wuzhou': '梧州', 'Beihai': '北海', 'Fangchenggang': '防城港', 'Qinzhou': '钦州', 'Guigang': '贵港', 'Yulin': '玉林', 'Baise': '百色', 'Hezhou': '贺州', 'Hechi': '河池', 'Laibin': '来宾', 'Chongzuo': '崇左',
  // 内蒙古
  'Hohhot': '呼和浩特', 'Baotou': '包头', 'Wuhai': '乌海', 'Chifeng': '赤峰', 'Tongliao': '通辽', 'Ordos': '鄂尔多斯', 'Hulunbuir': '呼伦贝尔', 'BayanNur': '巴彦淖尔', 'Ulanqab': '乌兰察布',
  // 新疆
  'Urumqi': '乌鲁木齐', 'Karamay': '克拉玛依', 'Turpan': '吐鲁番', 'Hami': '哈密',
  // 宁夏
  'Yinchuan': '银川', 'Shizuishan': '石嘴山', 'Wuzhong': '吴忠', 'Guyuan': '固原', 'Zhongwei': '中卫', 'Qinghai': '西宁'
};

// 判断解析结果的精细度得分
export function evaluatePrecision(locationStr) {
  if (!locationStr || locationStr === '中国' || locationStr === '未知地区') return 0;
  for (let prov of PROVINCES) {
    if (locationStr.includes(prov)) {
      if (locationStr.length > prov.length) {
        return 3;
      }
      return 1;
    }
  }
  if (locationStr.length >= 2) return 2;
  return 0;
}

// 统一提取省市名称并处理拼音转中文
export function cleanAndExtractLocation(rawStr) {
  if (!rawStr) return null;

  // 1. 优先提取国内中文“省+市”
  for (let prov of PROVINCES) {
    if (rawStr.includes(prov)) {
      let match = rawStr.match(new RegExp(`${prov}(?:省)?([\\u4e00-\\u9fa5]+)`));
      if (match && match[1]) {
        let cityName = match[1]
          .replace(/(电信|联通|移动|铁通|广电|长城宽带|教育网|阿里云|腾讯云|华为云|百度云|IDC|机房)/g, '')
          .trim();
        if (cityName) {
          return `${prov}${cityName}`;
        }
      }
      return prov;
    }
  }

  // 2. 基础杂质清洗
  let cleaned = rawStr
    .replace(/(电信|联通|移动|铁通|广电|长城宽带|教育网|阿里云|腾讯云|华为云|百度云|IDC|机房)/g, '')
    .replace(/^中国\s*/, '')
    .trim();

  // 3. 拼音自动转中文逻辑（针对 ShanxiYuncheng 等拼音情况）
  let pinyinProv = '';
  let pinyinCity = '';

  for (let pIn in PINYIN_PROVINCE_MAP) {
    if (cleaned.startsWith(pIn)) {
      pinyinProv = PINYIN_PROVINCE_MAP[pIn];
      let restStr = cleaned.slice(pIn.length);
      
      for (let cIn in PINYIN_CITY_MAP) {
        if (restStr.includes(cIn)) {
          pinyinCity = PINYIN_CITY_MAP[cIn];
          break;
        }
      }
      if (!pinyinCity && restStr) {
        pinyinCity = restStr.replace(/City|Province/gi, '').trim();
      }
      break;
    }
  }

  if (pinyinProv) {
    return `${pinyinProv}${pinyinCity}`;
  }

  return cleaned || null;
}
