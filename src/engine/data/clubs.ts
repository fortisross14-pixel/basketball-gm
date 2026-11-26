// Fictional club identities. City names are real places; clubs, nicknames,
// arenas and colours are invented for the core fictional universe.

export interface ClubSeed {
  name: string;
  nickname: string;
  abbrev: string;
  city: string;
  region: string;
  country: string;
  population: number;
  economy: number;
  prestige: number;
  colors: [string, string];
  arena: string;
  seats: number;
  tier: 1 | 2 | 3 | 0; // 0 = foreign (continental only)
}

export const CLUB_SEEDS: ClubSeed[] = [
  // ---------------------------------------------------------------- Liga Élite
  { name: 'Madrid Capital', nickname: 'Capitalinos', abbrev: 'MAD', city: 'Madrid', region: 'Madrid', country: 'ESP', population: 6700000, economy: 1.25, prestige: 95, colors: ['#f5f5f5', '#3a2a8c'], arena: 'Palacio de la Capital', seats: 15000, tier: 1 },
  { name: 'Barcelona Costa', nickname: 'Mariners', abbrev: 'BCO', city: 'Barcelona', region: 'Cataluña', country: 'ESP', population: 5600000, economy: 1.22, prestige: 93, colors: ['#a3003c', '#0a3d91'], arena: 'Pavelló del Port', seats: 12500, tier: 1 },
  { name: 'Gasteiz Araba', nickname: 'Gorris', abbrev: 'GAS', city: 'Vitoria-Gasteiz', region: 'País Vasco', country: 'ESP', population: 255000, economy: 1.15, prestige: 82, colors: ['#c8102e', '#0d1b2a'], arena: 'Gasteiz Arena', seats: 15000, tier: 1 },
  { name: 'Valencia Túria', nickname: 'Taronges', abbrev: 'VTU', city: 'Valencia', region: 'C. Valenciana', country: 'ESP', population: 1600000, economy: 1.05, prestige: 82, colors: ['#f28c00', '#111111'], arena: 'Pavelló del Túria', seats: 9000, tier: 1 },
  { name: 'Málaga Costa del Sol', nickname: 'Verdiblancos', abbrev: 'MAL', city: 'Málaga', region: 'Andalucía', country: 'ESP', population: 1000000, economy: 1.0, prestige: 78, colors: ['#007a3d', '#ffffff'], arena: 'Palacio de la Malagueta', seats: 10500, tier: 1 },
  { name: 'Badalona Verds', nickname: 'La Penya', abbrev: 'BDN', city: 'Badalona', region: 'Cataluña', country: 'ESP', population: 223000, economy: 1.05, prestige: 75, colors: ['#00843d', '#111111'], arena: 'Pavelló dels Verds', seats: 12000, tier: 1 },
  { name: 'Gran Canaria Atlántico', nickname: 'Claretianos', abbrev: 'GCA', city: 'Las Palmas', region: 'Canarias', country: 'ESP', population: 850000, economy: 0.95, prestige: 70, colors: ['#ffd200', '#00539f'], arena: 'Arena Atlántico', seats: 9800, tier: 1 },
  { name: 'Tenerife Teide', nickname: 'Laguneros', abbrev: 'TEN', city: 'La Laguna', region: 'Canarias', country: 'ESP', population: 640000, economy: 0.95, prestige: 68, colors: ['#0057b8', '#ffffff'], arena: 'Pabellón del Teide', seats: 5100, tier: 1 },
  { name: 'Murcia Huerta', nickname: 'Huertanos', abbrev: 'MUR', city: 'Murcia', region: 'Murcia', country: 'ESP', population: 460000, economy: 0.92, prestige: 64, colors: ['#d6001c', '#ffffff'], arena: 'Palacio de la Huerta', seats: 7500, tier: 1 },
  { name: 'Zaragoza Cierzo', nickname: 'Cierzo', abbrev: 'ZAR', city: 'Zaragoza', region: 'Aragón', country: 'ESP', population: 680000, economy: 1.0, prestige: 62, colors: ['#e4002b', '#1c1c1c'], arena: 'Pabellón del Ebro', seats: 10500, tier: 1 },
  { name: 'Bilbao Ría', nickname: 'Hombres de Negro', abbrev: 'BIL', city: 'Bilbao', region: 'País Vasco', country: 'ESP', population: 990000, economy: 1.15, prestige: 63, colors: ['#111111', '#ffffff'], arena: 'Ría Arena', seats: 10000, tier: 1 },
  { name: 'Manresa Bages', nickname: 'Bagencs', abbrev: 'MAN', city: 'Manresa', region: 'Cataluña', country: 'ESP', population: 78000, economy: 1.0, prestige: 58, colors: ['#ffcc00', '#1a1a1a'], arena: 'Pavelló Bages', seats: 5000, tier: 1 },
  { name: 'Sevilla Giralda', nickname: 'Giraldillos', abbrev: 'SEV', city: 'Sevilla', region: 'Andalucía', country: 'ESP', population: 1500000, economy: 0.92, prestige: 60, colors: ['#5c2d91', '#ffffff'], arena: 'Palacio del Guadalquivir', seats: 7600, tier: 1 },
  { name: 'Granada Nazarí', nickname: 'Nazaríes', abbrev: 'GRA', city: 'Granada', region: 'Andalucía', country: 'ESP', population: 530000, economy: 0.88, prestige: 55, colors: ['#c8102e', '#ffffff'], arena: 'Palacio de la Alhambra', seats: 7000, tier: 1 },
  { name: 'Burgos Castilla', nickname: 'Castellanos', abbrev: 'BUR', city: 'Burgos', region: 'Castilla y León', country: 'ESP', population: 176000, economy: 1.0, prestige: 56, colors: ['#5d1049', '#ffffff'], arena: 'Coliseo del Arlanzón', seats: 9500, tier: 1 },
  { name: 'Girona Onyar', nickname: 'Gironins', abbrev: 'GIR', city: 'Girona', region: 'Cataluña', country: 'ESP', population: 103000, economy: 1.05, prestige: 54, colors: ['#e2001a', '#ffffff'], arena: 'Pavelló de l\'Onyar', seats: 5200, tier: 1 },

  // ---------------------------------------------------------------- Liga Oro
  { name: 'Lugo Celtas', nickname: 'Celtas', abbrev: 'LUG', city: 'Lugo', region: 'Galicia', country: 'ESP', population: 98000, economy: 0.9, prestige: 50, colors: ['#00a3e0', '#ffffff'], arena: 'Pazo Municipal', seats: 5300, tier: 2 },
  { name: 'Valladolid Pisuerga', nickname: 'Pucelanos', abbrev: 'VLL', city: 'Valladolid', region: 'Castilla y León', country: 'ESP', population: 420000, economy: 0.98, prestige: 47, colors: ['#5b2c83', '#ffffff'], arena: 'Polideportivo Pisuerga', seats: 6000, tier: 2 },
  { name: 'Palencia Cerrato', nickname: 'Cerrateños', abbrev: 'PAL', city: 'Palencia', region: 'Castilla y León', country: 'ESP', population: 78000, economy: 0.92, prestige: 44, colors: ['#7a003c', '#ffffff'], arena: 'Pabellón del Carrión', seats: 6000, tier: 2 },
  { name: 'Oviedo Naranco', nickname: 'Carbayones', abbrev: 'OVI', city: 'Oviedo', region: 'Asturias', country: 'ESP', population: 220000, economy: 0.95, prestige: 42, colors: ['#003da5', '#ffffff'], arena: 'Polideportivo Naranco', seats: 3000, tier: 2 },
  { name: 'Cáceres Extremadura', nickname: 'Cacereños', abbrev: 'CAC', city: 'Cáceres', region: 'Extremadura', country: 'ESP', population: 96000, economy: 0.8, prestige: 38, colors: ['#007a33', '#ffffff'], arena: 'Multiusos Ciudad', seats: 6500, tier: 2 },
  { name: 'Alicante Benacantil', nickname: 'Benacantil', abbrev: 'ALI', city: 'Alicante', region: 'C. Valenciana', country: 'ESP', population: 760000, economy: 0.95, prestige: 46, colors: ['#0046ad', '#e10600'], arena: 'Centro de Tecnificación', seats: 5400, tier: 2 },
  { name: 'Castellón Plana', nickname: 'Orelluts', abbrev: 'CAS', city: 'Castellón', region: 'C. Valenciana', country: 'ESP', population: 310000, economy: 0.95, prestige: 39, colors: ['#000000', '#ffffff'], arena: 'Pabellón Ciutat', seats: 2800, tier: 2 },
  { name: 'Huesca Pirineo', nickname: 'Oscenses', abbrev: 'HUE', city: 'Huesca', region: 'Aragón', country: 'ESP', population: 53000, economy: 0.95, prestige: 36, colors: ['#0055a4', '#c8102e'], arena: 'Palacio de los Deportes', seats: 5000, tier: 2 },
  { name: 'Lleida Ponent', nickname: 'Ponentins', abbrev: 'LLE', city: 'Lleida', region: 'Cataluña', country: 'ESP', population: 140000, economy: 1.0, prestige: 42, colors: ['#e30613', '#ffffff'], arena: 'Pavelló Barris Nord', seats: 6100, tier: 2 },
  { name: 'Ourense Miño', nickname: 'Ourensanos', abbrev: 'OUR', city: 'Ourense', region: 'Galicia', country: 'ESP', population: 105000, economy: 0.85, prestige: 43, colors: ['#e30613', '#000000'], arena: 'Pazo dos Deportes', seats: 5500, tier: 2 },
  { name: 'Córdoba Mezquita', nickname: 'Califas', abbrev: 'COR', city: 'Córdoba', region: 'Andalucía', country: 'ESP', population: 320000, economy: 0.85, prestige: 37, colors: ['#006341', '#ffffff'], arena: 'Palacio de la Mezquita', seats: 3500, tier: 2 },
  { name: 'Santiago Compostela', nickname: 'Peregrinos', abbrev: 'SCQ', city: 'Santiago', region: 'Galicia', country: 'ESP', population: 98000, economy: 0.95, prestige: 45, colors: ['#00539b', '#ffffff'], arena: 'Multiusos Compostela', seats: 6000, tier: 2 },
  { name: 'Pamplona Iruña', nickname: 'Iruñeses', abbrev: 'PAM', city: 'Pamplona', region: 'Navarra', country: 'ESP', population: 360000, economy: 1.1, prestige: 38, colors: ['#d50032', '#ffffff'], arena: 'Iruña Arena', seats: 10000, tier: 2 },
  { name: 'Tarragona Tarraco', nickname: 'Tarraconenses', abbrev: 'TAR', city: 'Tarragona', region: 'Cataluña', country: 'ESP', population: 135000, economy: 1.0, prestige: 36, colors: ['#8b0000', '#ffd700'], arena: 'Palau d\'Esports', seats: 4500, tier: 2 },
  { name: 'Almería Indalo', nickname: 'Indálicos', abbrev: 'ALM', city: 'Almería', region: 'Andalucía', country: 'ESP', population: 200000, economy: 0.85, prestige: 34, colors: ['#d71920', '#ffffff'], arena: 'Pabellón del Indalo', seats: 2600, tier: 2 },
  { name: 'Cartagena Arsenal', nickname: 'Cartageneros', abbrev: 'CTG', city: 'Cartagena', region: 'Murcia', country: 'ESP', population: 215000, economy: 0.88, prestige: 35, colors: ['#1d1d1b', '#ffffff'], arena: 'Palacio de Deportes', seats: 3000, tier: 2 },

  // ---------------------------------------------------------------- Liga Plata
  { name: 'Gijón Cantábrico', nickname: 'Playos', abbrev: 'GIJ', city: 'Gijón', region: 'Asturias', country: 'ESP', population: 270000, economy: 0.95, prestige: 34, colors: ['#e30613', '#ffffff'], arena: 'Palacio del Cantábrico', seats: 5000, tier: 3 },
  { name: 'Albacete Navajas', nickname: 'Manchegos', abbrev: 'ALB', city: 'Albacete', region: 'Castilla-La Mancha', country: 'ESP', population: 175000, economy: 0.85, prestige: 30, colors: ['#ffffff', '#c8102e'], arena: 'Pabellón del Parque', seats: 2500, tier: 3 },
  { name: 'Salamanca Tormes', nickname: 'Charros', abbrev: 'SAL', city: 'Salamanca', region: 'Castilla y León', country: 'ESP', population: 145000, economy: 0.9, prestige: 32, colors: ['#0b3d91', '#ffffff'], arena: 'Pabellón del Tormes', seats: 3000, tier: 3 },
  { name: 'León Bernesga', nickname: 'Leoneses', abbrev: 'LEO', city: 'León', region: 'Castilla y León', country: 'ESP', population: 122000, economy: 0.88, prestige: 33, colors: ['#5e2750', '#ffffff'], arena: 'Palacio Municipal', seats: 6000, tier: 3 },
  { name: 'Logroño Ebro', nickname: 'Riojanos', abbrev: 'LOG', city: 'Logroño', region: 'La Rioja', country: 'ESP', population: 150000, economy: 1.0, prestige: 29, colors: ['#9e1b32', '#ffffff'], arena: 'Palacio de los Deportes', seats: 3800, tier: 3 },
  { name: 'Jaén Olivo', nickname: 'Olivareros', abbrev: 'JAE', city: 'Jaén', region: 'Andalucía', country: 'ESP', population: 112000, economy: 0.78, prestige: 26, colors: ['#007a33', '#ffd100'], arena: 'Pabellón del Olivar', seats: 2000, tier: 3 },
  { name: 'Toledo Imperial', nickname: 'Imperiales', abbrev: 'TOL', city: 'Toledo', region: 'Castilla-La Mancha', country: 'ESP', population: 85000, economy: 0.92, prestige: 25, colors: ['#5a2d82', '#ffd700'], arena: 'Pabellón del Tajo', seats: 1800, tier: 3 },
  { name: 'Cádiz Bahía', nickname: 'Gaditanos', abbrev: 'CAD', city: 'Cádiz', region: 'Andalucía', country: 'ESP', population: 220000, economy: 0.8, prestige: 28, colors: ['#ffd100', '#0033a0'], arena: 'Pabellón de la Bahía', seats: 1900, tier: 3 },
  { name: 'Huelva Colombina', nickname: 'Colombinos', abbrev: 'HLV', city: 'Huelva', region: 'Andalucía', country: 'ESP', population: 145000, economy: 0.8, prestige: 26, colors: ['#0033a0', '#ffffff'], arena: 'Palacio del Odiel', seats: 2200, tier: 3 },
  { name: 'Ávila Murallas', nickname: 'Abulenses', abbrev: 'AVI', city: 'Ávila', region: 'Castilla y León', country: 'ESP', population: 58000, economy: 0.85, prestige: 22, colors: ['#b5121b', '#ffffff'], arena: 'Pabellón San Antonio', seats: 1200, tier: 3 },
  { name: 'Soria Duero', nickname: 'Sorianos', abbrev: 'SOR', city: 'Soria', region: 'Castilla y León', country: 'ESP', population: 40000, economy: 0.9, prestige: 22, colors: ['#7f1734', '#ffffff'], arena: 'Pabellón del Duero', seats: 1500, tier: 3 },
  { name: 'Guadalajara Henares', nickname: 'Arriacenses', abbrev: 'GUA', city: 'Guadalajara', region: 'Castilla-La Mancha', country: 'ESP', population: 88000, economy: 0.98, prestige: 24, colors: ['#003da5', '#ffffff'], arena: 'Palacio Multiusos', seats: 5800, tier: 3 },
  { name: 'Segovia Acueducto', nickname: 'Segovianos', abbrev: 'SEG', city: 'Segovia', region: 'Castilla y León', country: 'ESP', population: 52000, economy: 0.95, prestige: 21, colors: ['#8b0000', '#ffffff'], arena: 'Pabellón del Eresma', seats: 1300, tier: 3 },
  { name: 'Ponferrada Bierzo', nickname: 'Bercianos', abbrev: 'PON', city: 'Ponferrada', region: 'Castilla y León', country: 'ESP', population: 63000, economy: 0.82, prestige: 24, colors: ['#0055a4', '#ffffff'], arena: 'Pabellón del Sil', seats: 2000, tier: 3 },
  { name: 'Mérida Augusta', nickname: 'Emeritenses', abbrev: 'MER', city: 'Mérida', region: 'Extremadura', country: 'ESP', population: 60000, economy: 0.78, prestige: 20, colors: ['#5c2d91', '#ffffff'], arena: 'Pabellón Guadiana', seats: 1100, tier: 3 },
  { name: 'Talavera Alfarera', nickname: 'Talaveranos', abbrev: 'TAL', city: 'Talavera', region: 'Castilla-La Mancha', country: 'ESP', population: 83000, economy: 0.8, prestige: 20, colors: ['#0b5394', '#ffffff'], arena: 'Pabellón de la Cerámica', seats: 1600, tier: 3 },

  // ---------------------------------------------------------------- Continental (foreign)
  { name: 'Athína Titans', nickname: 'Titans', abbrev: 'ATH', city: 'Athens', region: 'Attica', country: 'GRE', population: 3800000, economy: 0.95, prestige: 88, colors: ['#007a3d', '#ffffff'], arena: 'Olympic Dome', seats: 18000, tier: 0 },
  { name: 'Peiraias Navigators', nickname: 'Navigators', abbrev: 'PEI', city: 'Piraeus', region: 'Attica', country: 'GRE', population: 450000, economy: 0.95, prestige: 86, colors: ['#c8102e', '#ffffff'], arena: 'Harbour Arena', seats: 12000, tier: 0 },
  { name: 'Beograd Sokoli', nickname: 'Sokoli', abbrev: 'BEO', city: 'Belgrade', region: 'Serbia', country: 'SRB', population: 1700000, economy: 0.8, prestige: 84, colors: ['#1d1d1b', '#c8102e'], arena: 'Beograd Hala', seats: 18000, tier: 0 },
  { name: 'Istanbul Bosphorus', nickname: 'Bosphorus', abbrev: 'IST', city: 'Istanbul', region: 'Marmara', country: 'TUR', population: 15500000, economy: 1.0, prestige: 88, colors: ['#ffd100', '#001e62'], arena: 'Bosphorus Dome', seats: 13000, tier: 0 },
  { name: 'Ankara Anatolia', nickname: 'Anatolians', abbrev: 'ANK', city: 'Ankara', region: 'Central Anatolia', country: 'TUR', population: 5700000, economy: 0.9, prestige: 74, colors: ['#003399', '#ffffff'], arena: 'Anatolia Arena', seats: 10000, tier: 0 },
  { name: 'Kaunas Vytis', nickname: 'Knights', abbrev: 'KAU', city: 'Kaunas', region: 'Lithuania', country: 'LTU', population: 380000, economy: 0.85, prestige: 82, colors: ['#006a44', '#ffffff'], arena: 'Nemunas Arena', seats: 15000, tier: 0 },
  { name: 'Milano Meneghini', nickname: 'Meneghini', abbrev: 'MIL', city: 'Milan', region: 'Lombardy', country: 'ITA', population: 3200000, economy: 1.15, prestige: 84, colors: ['#e30613', '#ffffff'], arena: 'Forum Lombardo', seats: 12500, tier: 0 },
  { name: 'Bologna Torri', nickname: 'Torri', abbrev: 'BOL', city: 'Bologna', region: 'Emilia-Romagna', country: 'ITA', population: 1000000, economy: 1.05, prestige: 77, colors: ['#1d1d1b', '#ffffff'], arena: 'Arena delle Torri', seats: 9900, tier: 0 },
  { name: 'Tel Aviv Yam', nickname: 'Yam', abbrev: 'TLV', city: 'Tel Aviv', region: 'Israel', country: 'ISR', population: 4000000, economy: 1.1, prestige: 82, colors: ['#ffd100', '#003da5'], arena: 'Yam Arena', seats: 11000, tier: 0 },
  { name: 'Paris Lumière', nickname: 'Lumière', abbrev: 'PAR', city: 'Paris', region: 'Île-de-France', country: 'FRA', population: 11000000, economy: 1.2, prestige: 79, colors: ['#001e62', '#d6a461'], arena: 'Arena Lumière', seats: 8000, tier: 0 },
  { name: 'München Isar', nickname: 'Isar', abbrev: 'MUN', city: 'Munich', region: 'Bavaria', country: 'GER', population: 2900000, economy: 1.25, prestige: 80, colors: ['#dc052d', '#ffffff'], arena: 'Isar Dome', seats: 11500, tier: 0 },
  { name: 'Monaco Rocher', nickname: 'Rocher', abbrev: 'MON', city: 'Monaco', region: 'Monaco', country: 'MON', population: 40000, economy: 1.6, prestige: 81, colors: ['#e30613', '#ffffff'], arena: 'Salle du Rocher', seats: 4000, tier: 0 },
];
