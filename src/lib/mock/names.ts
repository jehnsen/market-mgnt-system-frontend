/**
 * Name pools for generated, fictional people. Given names and surnames are
 * combined at random; any resemblance to a real person is coincidental.
 */
export const GIVEN_NAMES = [
  'Adelaida', 'Aileen', 'Alma', 'Amparo', 'Analyn', 'Aurora', 'Belen', 'Brenda', 'Carmela', 'Cecilia',
  'Charito', 'Concepcion', 'Daisy', 'Divina', 'Editha', 'Elena', 'Elvira', 'Emelyn', 'Erlinda', 'Estrella',
  'Felisa', 'Flordeliza', 'Gemma', 'Gloria', 'Imelda', 'Irene', 'Jocelyn', 'Juliet', 'Leonila', 'Liza',
  'Lourdes', 'Lucila', 'Luzviminda', 'Marilou', 'Marivic', 'Merlita', 'Milagros', 'Mylene', 'Nelia', 'Norma',
  'Ofelia', 'Perla', 'Remedios', 'Rosalie', 'Rowena', 'Salvacion', 'Shirley', 'Teresita', 'Virginia', 'Wilma',
  'Alfredo', 'Allan', 'Antonio', 'Arnel', 'Benjamin', 'Bernardo', 'Cesar', 'Danilo', 'Dante', 'Domingo',
  'Edgardo', 'Efren', 'Elmer', 'Ernesto', 'Felix', 'Fernando', 'Gerardo', 'Gilbert', 'Honorio', 'Ignacio',
  'Jaime', 'Jerry', 'Jonathan', 'Jose', 'Leonardo', 'Lito', 'Manuel', 'Mario', 'Nestor', 'Noel',
  'Orlando', 'Pablo', 'Rafael', 'Reynaldo', 'Roberto', 'Rodrigo', 'Rolando', 'Romeo', 'Ronaldo', 'Rudy',
  'Samuel', 'Teodoro', 'Virgilio', 'Wilfredo', 'Zaldy', 'Ricky', 'Junrey', 'Kristine', 'Mae', 'Jessa',
] as const

export const SURNAMES = [
  'Abellar', 'Acosta', 'Albao', 'Almalbis', 'Andrada', 'Arceño', 'Bacolod', 'Balderas', 'Baldevia', 'Belarmino',
  'Besana', 'Billones', 'Bolivar', 'Buenaflor', 'Cabalfin', 'Calizo', 'Castor', 'Cordero', 'Dalisay', 'Delos Santos',
  'Desales', 'Dumaguit', 'Dorado', 'Escarda', 'Esmeralda', 'Fabila', 'Fuentes', 'Gallo', 'Gardoce', 'Gonzaga',
  'Hilario', 'Ilustrisimo', 'Jamandre', 'Labrador', 'Lachica', 'Lapaz', 'Libo-on', 'Lumawag', 'Magbanua', 'Malagos',
  'Mangilog', 'Matias', 'Navarra', 'Obligar', 'Odiamar', 'Olaguer', 'Panaguiton', 'Pastrana', 'Pelaez', 'Penuela',
  'Quimpo', 'Rebaldo', 'Ricafort', 'Rubrico', 'Sabando', 'Salvana', 'Segovia', 'Sinag', 'Sumagaysay', 'Tabuyo',
  'Ticao', 'Tolentino', 'Ubaldo', 'Valdemoro', 'Vargas', 'Villaruel', 'Yap', 'Zamora', 'Apolinario', 'Benedicto',
] as const

export const MIDDLE_INITIALS = 'ABCDEFGLMNOPRSTV'.split('')

export const BARANGAYS = [
  'Agbanog', 'Bailan', 'Banate', 'Binuntucan', 'Guba', 'Hipona', 'Ilawod (Pob.)', 'Ilaya (Pob.)', 'Intungcan',
  'Lantangan', 'Linampongan', 'Manapao', 'San Pedro', 'Solo', 'Sublangon', 'Tabuc', 'Tacas', 'Yatingan',
] as const

export const BUSINESS_SUFFIX: Record<string, readonly string[]> = {
  meat: ['Meat Shop', 'Fresh Pork & Beef', 'Meat Supply'],
  dry_goods: ['General Merchandise', 'Dry Goods', 'Sari-sari & Supplies', 'RTW & Textiles'],
  vegetables: ['Vegetable Stand', 'Gulay & Prutas', 'Farm Fresh'],
  eateries: ['Carinderia', 'Eatery', 'Kakanin & Merienda'],
  others: ['Rice Retail', 'Eggs & Poultry', 'Cellphone Load & Repair', 'Bakery Outlet'],
  fish: ['Fish Vendor', 'Seafoods', 'Fresh Catch'],
}

export const TRANSIENT_GOODS = [
  'Sardines (tuloy)',
  'Shrimp (pasayan)',
  'Mud crab (alimango)',
  'Squid (lukos)',
  'Oysters (talaba)',
  'Mussels (tahong)',
  'Milkfish (bangus)',
  'Dried fish (bulad)',
  'Seaweed (guso)',
  'Blue crab (kasag)',
  'Tilapia',
  'Shellfish (litub)',
] as const
