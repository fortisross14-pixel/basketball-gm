// Fictional name pools. Combinations are random; no real players are modelled.

export interface NamePool {
  country: string;
  region: 'ESP' | 'EU' | 'NONEU';
  first: string[];
  last: string[];
  weight: number;
}

export const NAME_POOLS: NamePool[] = [
  {
    country: 'ESP', region: 'ESP', weight: 50,
    first: ['Alejandro', 'Pablo', 'Sergio', 'Javier', 'Daniel', 'Adrián', 'Álvaro', 'Hugo', 'Mario', 'Diego', 'Iván', 'Rubén', 'Marc', 'Pau', 'Jordi', 'Íñigo', 'Unai', 'Aitor', 'Gorka', 'Xabier', 'Raúl', 'Carlos', 'Víctor', 'Jaime', 'Gonzalo', 'Nicolás', 'Martín', 'Lucas', 'Óscar', 'Alberto', 'Rodrigo', 'Bruno', 'Eric', 'Arnau', 'Oriol', 'Guillem', 'Joel', 'Héctor', 'Samuel', 'Andrés', 'Miguel', 'Fernando', 'Enrique', 'Manuel', 'Ismael', 'Saúl', 'Tomás', 'Borja', 'Asier', 'Jon'],
    last: ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina', 'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto', 'Méndez', 'Calvo', 'Gallego', 'Vidal', 'León', 'Herrera', 'Márquez', 'Peña', 'Flores', 'Cabrera', 'Campos', 'Vega', 'Fuentes', 'Carrasco', 'Diez', 'Caballero', 'Reyes', 'Nieto', 'Aguilar', 'Pascual', 'Santana', 'Herrero', 'Lorenzo', 'Montero', 'Hidalgo', 'Giménez', 'Ibáñez', 'Ferrer', 'Duran', 'Santiago', 'Benítez', 'Mora', 'Vicente', 'Arias', 'Vargas', 'Carmona', 'Crespo', 'Román', 'Pastor', 'Soto', 'Sáez', 'Velasco', 'Moya', 'Soler', 'Parra', 'Esteban', 'Bravo', 'Gallardo', 'Rojas', 'Etxeberria', 'Aguirre', 'Puig', 'Roca', 'Casals', 'Bosch', 'Mas', 'Pujol', 'Arregui', 'Zubizarreta', 'Olano'],
  },
  {
    country: 'FRA', region: 'EU', weight: 5,
    first: ['Théo', 'Hugo', 'Louis', 'Mathis', 'Nolan', 'Bastien', 'Yanis', 'Killian', 'Moussa', 'Enzo', 'Rudy', 'Evan', 'Axel', 'Sékou'],
    last: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Lefèvre', 'Girard', 'Fournier', 'Diallo', 'Traoré', 'Mercier', 'Blanc', 'Faure', 'Chevalier', 'Rousseau', 'Mbaye'],
  },
  {
    country: 'SRB', region: 'EU', weight: 5,
    first: ['Nikola', 'Marko', 'Stefan', 'Luka', 'Miloš', 'Nemanja', 'Aleksa', 'Vasilije', 'Ognjen', 'Filip', 'Dušan', 'Uroš'],
    last: ['Petrović', 'Jovanović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić', 'Pavlović', 'Kovačević', 'Lazić', 'Radović', 'Simić', 'Tomić', 'Milić'],
  },
  {
    country: 'LTU', region: 'EU', weight: 4,
    first: ['Mantas', 'Lukas', 'Domantas', 'Tomas', 'Rokas', 'Arnas', 'Ignas', 'Marius', 'Deividas', 'Gytis', 'Paulius'],
    last: ['Kazlauskas', 'Jankauskas', 'Petrauskas', 'Stankevičius', 'Vasiliauskas', 'Žukauskas', 'Butkus', 'Paulauskas', 'Urbonas', 'Navickas', 'Mažeika'],
  },
  {
    country: 'GRE', region: 'EU', weight: 4,
    first: ['Giorgos', 'Kostas', 'Nikos', 'Dimitris', 'Vasilis', 'Panagiotis', 'Thanasis', 'Ioannis', 'Michalis', 'Stavros'],
    last: ['Papadopoulos', 'Georgiou', 'Nikolaidis', 'Konstantinou', 'Papanikolaou', 'Vasileiou', 'Antoniou', 'Christodoulou', 'Karagiannis', 'Lekkas', 'Doukas'],
  },
  {
    country: 'ITA', region: 'EU', weight: 4,
    first: ['Matteo', 'Lorenzo', 'Alessandro', 'Andrea', 'Federico', 'Simone', 'Nicolò', 'Giacomo', 'Riccardo', 'Davide', 'Tommaso'],
    last: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'Mancini'],
  },
  {
    country: 'GER', region: 'EU', weight: 3,
    first: ['Lukas', 'Jonas', 'Leon', 'Moritz', 'Niklas', 'Tim', 'Felix', 'Johannes', 'Maximilian', 'Paul', 'Isaac'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Wolf', 'Neumann', 'Krüger'],
  },
  {
    country: 'CRO', region: 'EU', weight: 3,
    first: ['Ivan', 'Dario', 'Mario', 'Ante', 'Josip', 'Luka', 'Roko', 'Krunoslav', 'Bojan', 'Mateo'],
    last: ['Horvat', 'Kovačić', 'Babić', 'Marić', 'Jurić', 'Novak', 'Knežević', 'Vuković', 'Perić', 'Šarić', 'Grgić'],
  },
  {
    country: 'SLO', region: 'EU', weight: 2,
    first: ['Jaka', 'Žiga', 'Klemen', 'Gregor', 'Aleksej', 'Luka', 'Matic'],
    last: ['Novak', 'Horvat', 'Kranjc', 'Zupan', 'Potočnik', 'Kos', 'Vidmar', 'Rozman'],
  },
  {
    country: 'POR', region: 'EU', weight: 2,
    first: ['João', 'Tiago', 'Rafael', 'Diogo', 'Gonçalo', 'Rúben', 'Miguel', 'Neemias'],
    last: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Lopes', 'Almeida'],
  },
  {
    country: 'TUR', region: 'EU', weight: 3,
    first: ['Emre', 'Burak', 'Mehmet', 'Can', 'Alperen', 'Furkan', 'Ömer', 'Cedi', 'Doğuş', 'Tarık'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Korkmaz'],
  },
  {
    country: 'USA', region: 'NONEU', weight: 14,
    first: ['Jalen', 'Marcus', 'Tyrese', 'DeAndre', 'Malik', 'Jordan', 'Isaiah', 'Brandon', 'Kevin', 'Darius', 'Trey', 'Andre', 'Cameron', 'Elijah', 'Jamal', 'Terrence', 'Quinton', 'Devin', 'Chris', 'Josh', 'Tyler', 'Kendrick', 'Dwayne', 'Lamar', 'Xavier', 'Shaun', 'Corey', 'Reggie'],
    last: ['Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Thompson', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Hill', 'Green', 'Baker', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Bell', 'Bailey', 'Cooper', 'Richardson', 'Howard', 'Ward', 'Watson', 'Brooks', 'Sanders', 'Price', 'Bennett', 'Hayes', 'Bryant', 'Russell', 'Griffin', 'Fuller'],
  },
  {
    country: 'ARG', region: 'NONEU', weight: 2,
    first: ['Facundo', 'Nicolás', 'Leandro', 'Agustín', 'Tomás', 'Gabriel', 'Patricio', 'Luciano'],
    last: ['Benedetti', 'Ledesma', 'Quiroga', 'Ferraro', 'Ibarra', 'Medina', 'Fernández', 'Acuña', 'Sosa', 'Romano'],
  },
  {
    country: 'BRA', region: 'NONEU', weight: 2,
    first: ['Bruno', 'Yago', 'Lucas', 'Marcelo', 'Gui', 'Rafael', 'Didi'],
    last: ['Moraes', 'Teixeira', 'Santos', 'Carvalho', 'Barbosa', 'Dias', 'Ribeiro', 'Machado'],
  },
  {
    country: 'SEN', region: 'NONEU', weight: 2,
    first: ['Moussa', 'Ibrahima', 'Cheikh', 'Mamadou', 'Youssou', 'Babacar', 'Ousmane'],
    last: ['Ndiaye', 'Diop', 'Faye', 'Sow', 'Fall', 'Seck', 'Gueye', 'Niang', 'Sy'],
  },
  {
    country: 'NGA', region: 'NONEU', weight: 2,
    first: ['Chima', 'Emeka', 'Obinna', 'Tunde', 'Ike', 'Josh', 'Precious'],
    last: ['Obi', 'Nnamdi', 'Chukwu', 'Okeke', 'Eze', 'Adeyemi', 'Balogun', 'Uche'],
  },
  {
    country: 'DOM', region: 'NONEU', weight: 1,
    first: ['Ángel', 'Juan', 'Andrés', 'Víctor', 'Eloy'],
    last: ['Delgado', 'Vargas', 'Almonte', 'Batista', 'Guzmán', 'Peña'],
  },
  {
    country: 'CAN', region: 'NONEU', weight: 2,
    first: ['Dylan', 'Kyle', 'Owen', 'Liam', 'Andrew', 'Nathan', 'Ethan'],
    last: ['Brooks', 'MacLeod', 'Tremblay', 'Gagnon', 'Murray', 'Fraser', 'Côté'],
  },
];

export const STAFF_FIRST = ['Pedro', 'Luis', 'Joan', 'Ricard', 'Salva', 'Óscar', 'Roberto', 'Paco', 'Chus', 'Natxo', 'Ibon', 'Félix', 'Lucía', 'Marta', 'Elena', 'Laura', 'Cristina', 'Anna', 'Sara', 'Nuria', 'Amaya', 'Ainhoa', 'Ane', 'Raquel', 'Teresa', 'Dragan', 'Marco', 'Giorgos', 'Tomas', 'Mike', 'Andrea', 'Kerem', 'Pablo', 'Manolo', 'Javi', 'Xavi', 'Josep', 'Diego', 'Fran', 'Quique', 'Toni', 'Alfonso', 'Begoña', 'Irene'];
export const STAFF_LAST = ['Martínez', 'Lavín', 'Ochoa', 'Salgado', 'Villar', 'Pascual', 'Navarro', 'Hernández', 'Sanz', 'Borrego', 'Esteller', 'Royo', 'Mateo', 'Aguilar', 'Olmos', 'Calvo', 'Mencía', 'Urtasun', 'Zamora', 'Bueno', 'Echevarría', 'Quintana', 'Barrios', 'Toledo', 'Arroyo', 'Escobar', 'Valverde', 'Robles', 'Bermejo', 'Lucero', 'Petrakis', 'Novaković', 'Bellini', 'Kaplan', 'Weiss', 'Duarte', 'Rinaldi', 'Ozcan', 'Ferrán', 'Cuesta', 'Montoya', 'Salinas', 'Tapia', 'Requena'];

export const OUTLETS = {
  national: ['Diario Canasta', 'Gigantes del Aro', 'Marcador Nacional', 'El Triple', 'Radio Deporte', 'Zona Pick', 'La Bombilla'],
  local: ['Crónica Local', 'Gazeta de la Ciudad', 'Onda Municipal', 'El Vigía', 'Voz del Barrio'],
  fan: ['Grada Animación (fan channel)', 'Peña Oficial (fan podcast)', 'Curva Norte TV', 'Foro de la Afición'],
  international: ['EuroHoops Daily', 'Continental Basket', 'Draft Watch Europe'],
};

export const SPONSOR_BRANDS: { brand: string; category: string; risk: number }[] = [
  { brand: 'Cervecera del Norte', category: 'Beverage', risk: 25 },
  { brand: 'Banco Mediterráneo', category: 'Banking', risk: 10 },
  { brand: 'Seguros Atalaya', category: 'Insurance', risk: 5 },
  { brand: 'TeleVértice', category: 'Telecom', risk: 10 },
  { brand: 'Energía Sol', category: 'Energy', risk: 30 },
  { brand: 'ApuestaYa', category: 'Betting', risk: 70 },
  { brand: 'Supermercados Frescor', category: 'Retail', risk: 5 },
  { brand: 'Autos Ibérica', category: 'Automotive', risk: 10 },
  { brand: 'Construcciones Roble', category: 'Construction', risk: 35 },
  { brand: 'Viajes Brújula', category: 'Travel', risk: 5 },
  { brand: 'Lácteos Pradera', category: 'Food', risk: 5 },
  { brand: 'CryptoNex', category: 'Crypto', risk: 80 },
  { brand: 'Universidad Atlántica', category: 'Education', risk: 0 },
  { brand: 'Clínica Vitalis', category: 'Health', risk: 5 },
  { brand: 'Hoteles Alba', category: 'Hospitality', risk: 10 },
  { brand: 'Zapatillas Vuelo', category: 'Apparel', risk: 10 },
  { brand: 'NetCanal Stream', category: 'Media', risk: 10 },
  { brand: 'Aceites Olivar', category: 'Food', risk: 0 },
  { brand: 'Logística Rápida', category: 'Logistics', risk: 10 },
  { brand: 'Vinos Ribera Alta', category: 'Beverage', risk: 20 },
  { brand: 'FinTech Kubo', category: 'Fintech', risk: 40 },
  { brand: 'Grupo Inmobiliario Faro', category: 'Real estate', risk: 40 },
  { brand: 'Tecnologías Delta', category: 'Technology', risk: 10 },
  { brand: 'Aerolínea Celeste', category: 'Travel', risk: 15 },
  { brand: 'Ayuntamiento (Turismo)', category: 'Public', risk: 0 },
  { brand: 'Petroquímica Gran Puerto', category: 'Energy', risk: 55 },
];

export const BROADCASTERS: { name: string; kind: 'public' | 'payTV' | 'streamer' | 'regional' | 'global' }[] = [
  { name: 'Televisión Pública Nacional', kind: 'public' },
  { name: 'Canal Deportes+', kind: 'payTV' },
  { name: 'StreamArena', kind: 'streamer' },
  { name: 'Televisión Autonómica', kind: 'regional' },
  { name: 'GlobalSport Network', kind: 'global' },
  { name: 'HoopPass', kind: 'streamer' },
  { name: 'Canal Cancha', kind: 'payTV' },
];

export const INJURY_TYPES: { type: string; min: number; max: number; severity: 'minor' | 'moderate' | 'major'; w: number }[] = [
  { type: 'Ankle sprain', min: 5, max: 21, severity: 'minor', w: 30 },
  { type: 'Knee contusion', min: 3, max: 10, severity: 'minor', w: 15 },
  { type: 'Hamstring strain', min: 10, max: 28, severity: 'moderate', w: 14 },
  { type: 'Back spasms', min: 3, max: 14, severity: 'minor', w: 10 },
  { type: 'Calf strain', min: 10, max: 30, severity: 'moderate', w: 8 },
  { type: 'Broken finger', min: 20, max: 40, severity: 'moderate', w: 6 },
  { type: 'Concussion', min: 7, max: 21, severity: 'moderate', w: 5 },
  { type: 'Plantar fasciitis', min: 20, max: 60, severity: 'moderate', w: 4 },
  { type: 'Meniscus tear', min: 45, max: 110, severity: 'major', w: 3 },
  { type: 'Broken foot', min: 50, max: 120, severity: 'major', w: 2 },
  { type: 'Achilles rupture', min: 200, max: 300, severity: 'major', w: 0.6 },
  { type: 'ACL tear', min: 220, max: 320, severity: 'major', w: 0.8 },
];
