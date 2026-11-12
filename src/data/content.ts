export const company = {
  name: 'Alpha Recover',
  shortName: 'Alpha Recover',
  tagline: 'Data recovery training that pays for itself',
  email: 'info@alpharecover.com',
  phone: '6355197917',
  phoneDisplay: '+91 63551 97917',
  phoneHref: 'tel:+916355197917',
  whatsapp: 'https://wa.me/916355197917',
  address: 'Ahmedabad, Gujarat, India',
  addressFull: '12th Floor, Skyline Business Hub, SG Highway, Ahmedabad, Gujarat 380001, India',
  hours: 'Mon – Sat, 9:00 AM – 6:00 PM',
  replyNote: 'We reply within 24 hours',
  visitNote: 'Visit by appointment only.',
  cin: 'Pending registration',
  gst: 'Pending',
};

export const stats = [
  { value: '4', label: 'Languages', detail: 'English - Hindi - Spanish - French' },
  { value: '10K+', label: 'Trainees', detail: 'Learners worldwide' },
  { value: '15K+', label: 'Cases / Year', detail: 'Recovery assistance' },
  { value: '6K+', label: 'Remote Assists', detail: 'Live technician support' },
  { value: '10+', label: 'Years', detail: 'Service & training' },
  { value: '100%', label: 'Privacy Focus', detail: 'Client data handled carefully' },
];

export const heroHighlights = [
  { id: 'hands-on', label: 'Real Hands-on Training' },
  { id: 'lifetime', label: 'Lifetime Portal Access' },
  { id: 'mentorship', label: 'Expert Mentorship' },
  { id: 'skills', label: 'Industry Relevant Skills' },
];

export const quickActions = [
  {
    label: 'Logical Recovery',
    to: '/training/logical',
    hint: 'Learn advanced logical data recovery techniques.',
  },
  {
    label: 'PCB Repair',
    to: '/training/electrical',
    hint: 'Master PCB diagnosis and repair skills.',
  },
  {
    label: 'Firmware Tools',
    to: '/training/firmware-basic',
    hint: 'Work with professional firmware tools.',
  },
  {
    label: 'MRT Techniques',
    to: '/training/mrt',
    hint: 'Learn modern MRT recovery methods.',
  },
];

export const recoverySolutions = [
  {
    id: 'logical',
    title: 'Logical Data Recovery Solutions',
    text: 'Helps recover lost, deleted, corrupted, or inaccessible files when the storage device is physically working but has software, file-system, or partition-related issues.',
    to: '/training/logical',
    accent: '#D9B56E',
  },
  {
    id: 'electrical',
    title: 'Electrical Data Recovery Solutions',
    text: 'Focuses on recovering data from devices affected by electronic failures, power surges, short circuits, or damaged circuit boards.',
    to: '/training/electrical',
    accent: '#4D7A73',
  },
  {
    id: 'mechanical',
    title: 'Mechanical Data Recovery Solutions',
    text: 'Used when physical components such as hard drive heads, motors, platters, or other moving parts are damaged and require specialized recovery techniques.',
    to: '/training/mechanical',
    accent: '#CFDDD8',
  },
  {
    id: 'firmware',
    title: 'Firmware Data Recovery Solutions',
    text: 'Addresses problems with the device’s internal firmware, which controls how the storage device operates and communicates with a computer, making the data inaccessible.',
    to: '/training/firmware-basic',
    accent: '#D9B56E',
  },
];

export type Lesson = { id: string; title: string };
export type CourseModule = { id: string; title: string; lessons: Lesson[] };
export type TrainingTrack = {
  id: string;
  title: string;
  summary: string;
  modules: CourseModule[];
};

export const trainingTracks: TrainingTrack[] = [
  {
    id: 'logical',
    title: 'Logical Failure Data Recovery',
    summary: 'Software-level recovery: partitions, raw drives, imaging, cloning, and common OS cases.',
    modules: [
      {
        id: 'logical-core',
        title: 'Logical (Software) Level',
        lessons: [
          { id: 'l1', title: 'Introduction' },
          { id: 'l2', title: 'Lost Partition Drive Recovery' },
          { id: 'l3', title: 'Raw Partition / Drive Recovery' },
          { id: 'l4', title: 'I/O Error & Damaged Drive Redundancy' },
          { id: 'l5', title: 'Bad Sector Affected Drive Recovery' },
          { id: 'l6', title: 'Mac Drive Data Recovery' },
          { id: 'l7', title: 'Data Wiping / Low Level Format / Zero Fill' },
          { id: 'l8', title: 'Lost Partition Recovery in Minutes' },
          { id: 'l9', title: 'Hard Disk Software Cloning' },
          { id: 'l10', title: 'Dynamic Disk & RAID 0 Volume Recovery' },
          { id: 'l11', title: 'How to Start Logical Data Recovery' },
          { id: 'l12', title: 'Photo & Video Recovery with Free Tools' },
          { id: 'l13', title: 'Missing Desktop / Documents Recovery' },
          { id: 'l14', title: 'Secondary Port Activation for Recovery' },
          { id: 'l15', title: 'Seagate vs WD for Recovery Work' },
          { id: 'l16', title: 'Missing Drive Letter' },
        ],
      },
      {
        id: 'expert',
        title: 'Expert Level Recovery',
        lessons: [
          { id: 'e1', title: 'DVR Hard Disk: Channel-wise Recovery' },
          { id: 'e2', title: 'System Hang Drive Recovery (No Firmware Repair)' },
          { id: 'e3', title: 'Reverse Cloning & Imaging Bad Sector Drives' },
          { id: 'e4', title: 'Auto BitLocker / TPM 1.2 / Windows Recovery' },
          { id: 'e5', title: 'Video File Repair (.mov & .mp4)' },
          { id: 'e6', title: 'Restart Imaging on Incomplete Image Files' },
          { id: 'e7', title: 'VHD Creation & Recovery on Windows' },
          { id: 'e8', title: 'WD My Passport / Spyglass Password Hang Cases' },
          { id: 'e9', title: 'Windows 10/11 Detection & Disk Management Hang' },
          { id: 'e10', title: 'Virus Infected Pendrive Recovery' },
        ],
      },
    ],
  },
  {
    id: 'electrical',
    title: 'Electrical (PCB) Failure Data Recovery',
    summary: 'PCB structure, pinouts, symptoms, donor swap, and brand-specific board work.',
    modules: [
      {
        id: 'pcb',
        title: 'PCB Fundamentals & Practice',
        lessons: [
          { id: 'p1', title: 'Introduction to PCB' },
          { id: 'p2', title: 'Hard Disk Interface Pin Out' },
          { id: 'p3', title: 'Hard Disk PCB Structure' },
          { id: 'p4', title: 'Damage Symptoms and Repairing' },
          { id: 'p5', title: 'PCB Replacement' },
          { id: 'p6', title: 'WD USB 3.0 PCB Structure — Theory' },
          { id: 'p7', title: 'WD USB 3.0 PCB Structure — Practical' },
          { id: 'p8', title: 'WD USB 3.0 PCB Replacement — Theory' },
          { id: 'p9', title: 'WD USB 3.0 PCB Replacement — Practical' },
          { id: 'p10', title: 'Seagate PCB Structure & Fault Testing' },
          { id: 'p11', title: 'WD PCB Structure & Fault Testing' },
          { id: 'p12', title: 'Toshiba & Hitachi PCB Testing' },
        ],
      },
    ],
  },
  {
    id: 'mechanical',
    title: 'Mechanical Failure Data Recovery',
    summary: 'Heads, donors, stuck spindles, sound diagnosis, and clean-room process basics.',
    modules: [
      {
        id: 'mech',
        title: 'Mechanical Recovery',
        lessons: [
          { id: 'm1', title: 'Mechanical Structure & Components' },
          { id: 'm2', title: 'Failure Symptoms & Sound Detection' },
          { id: 'm3', title: 'Introduction to Mechanical Tools' },
          { id: 'm4', title: 'Donor Selection for Head Replacement' },
          { id: 'm5', title: 'Head Stuck Problem — Practical' },
        ],
      },
    ],
  },
  {
    id: 'firmware-basic',
    title: 'Basic Firmware Repairing',
    summary: 'Firmware concepts, Seagate and WD basic repair flows, and case study videos.',
    modules: [
      {
        id: 'fw-concepts',
        title: 'Hard Disk Basic Concepts',
        lessons: [
          { id: 'f1', title: 'Firmware Introduction' },
          { id: 'f2', title: 'Failure Reasons & Symptoms' },
          { id: 'f3', title: 'Defect List & SMART Table' },
        ],
      },
      {
        id: 'seagate-fw',
        title: 'Seagate Firmware Repair',
        lessons: [
          { id: 's1', title: 'Seagate Firmware Architecture' },
          { id: 's2', title: 'Basic Firmware Commands' },
          { id: 's3', title: 'Repair System Setup — Practical' },
          { id: 's4', title: 'Error Messages & Solutions' },
          { id: 's5', title: 'Terminal Unlock Theory' },
          { id: 's6', title: 'Head Amplifier Short Method' },
          { id: 's7', title: 'Terminal Unlock Motor Servo Method' },
        ],
      },
      {
        id: 'wd-fw',
        title: 'WD Firmware Repair',
        lessons: [
          { id: 'w1', title: 'WD Introduction' },
          { id: 'w2', title: 'Firmware Repair System Setup' },
          { id: 'w3', title: 'Starting Work with WD Firmware Tools' },
          { id: 'w4', title: 'Status & Repair Register Flags' },
          { id: 'w5', title: 'WD ROM & Microcode' },
          { id: 'w6', title: 'Module Read & Backup' },
          { id: 'w7', title: 'Important Tool Features' },
        ],
      },
      {
        id: 'cases',
        title: 'Data Recovery Case Studies',
        lessons: [
          { id: 'c1', title: 'Seagate Pipeline HD — No Host FIS' },
          { id: 'c2', title: 'Seagate Barracuda 7200.9 — Not Interface Ready' },
          { id: 'c3', title: 'Seagate Momentus Thin — SIM Error 3005' },
          { id: 'c4', title: 'WD Blue Midori — System Hang' },
          { id: 'c5', title: 'WD My Passport Charger Family — Native Fix' },
          { id: 'c6', title: 'Seagate 3TB Low Health Repair' },
          { id: 'c7', title: 'WD EasyShare Spyglass — System Hang' },
        ],
      },
    ],
  },
  {
    id: 'mrt',
    title: 'Advanced Firmware Repairing on MRT',
    summary: 'MRT Ultra hardware, Seagate/WD advanced modules, and data extractor workflows.',
    modules: [
      {
        id: 'mrt-intro',
        title: 'Introduction of MRT Tool',
        lessons: [
          { id: 'mi1', title: 'Advance Firmware Tools Overview' },
          { id: 'mi2', title: 'MRT Ultra Hardware Introduction' },
          { id: 'mi3', title: 'Unboxing & Hardware Tour' },
          { id: 'mi4', title: 'Install, Register & Activate' },
          { id: 'mi5', title: 'Software UI Overview' },
        ],
      },
      {
        id: 'mrt-seagate',
        title: 'MRT Seagate Firmware Repair',
        lessons: [
          { id: 'ms1', title: 'Defect Management, G-list, P-list, SMART' },
          { id: 'ms2', title: 'Translator & NRG List' },
          { id: 'ms3', title: 'Starting Seagate Work in MRT' },
          { id: 'ms4', title: 'MRT Seagate UI' },
          { id: 'ms5', title: 'ROM Operations — Read / Write / Backup' },
          { id: 'ms6', title: 'SYS Files — Ready Condition Drive' },
          { id: 'ms7', title: 'SYS Files — Busy Condition Drive' },
          { id: 'ms8', title: 'ATA / Serial / ABA Backup Modes' },
          { id: 'ms9', title: 'Three Phases: Backup, Repair, Extract' },
        ],
      },
      {
        id: 'mrt-wd',
        title: 'MRT WD Advanced Firmware',
        lessons: [
          { id: 'mw1', title: 'MRT WD UI Introduction' },
          { id: 'mw2', title: 'Important Menus & Functions' },
          { id: 'mw3', title: 'WD ROM Operations — Part 1' },
          { id: 'mw4', title: 'WD ROM Operations — Part 2' },
          { id: 'mw5', title: 'Important Firmware Modules' },
          { id: 'mw6', title: 'SA Testing & Address Shifting' },
          { id: 'mw7', title: 'Ready & Busy Fix Recovery' },
          { id: 'mw8', title: 'Module Backup via TV9 / TV10 Short' },
        ],
      },
      {
        id: 'mrt-extract',
        title: 'MRT Data Extractor',
        lessons: [
          { id: 'me1', title: 'File Explorer Overview' },
          { id: 'me2', title: 'Create VHD for Recovery Work' },
          { id: 'me3', title: 'Attach / Detach VHD & Recover' },
          { id: 'me4', title: 'Create Image Files' },
          { id: 'me5', title: 'Head Mapping & Selective Head Recovery' },
        ],
      },
    ],
  },
  {
    id: 'media',
    title: 'Photo and Video Recovery',
    summary: 'Media repair, ransom-affected files, memory cards, and CHKDSK extension issues.',
    modules: [
      {
        id: 'media-mod',
        title: 'Photo & Video',
        lessons: [
          { id: 'pv1', title: 'Recovery with Free Software' },
          { id: 'pv2', title: 'Repair Damaged .mov & .mp4' },
          { id: 'pv3', title: 'Older Ransom Encrypted Drive Repair' },
          { id: 'pv4', title: 'JPEG Decryption Tools Overview' },
          { id: 'pv5', title: 'Bad Sector Memory Card Recovery' },
          { id: 'pv6', title: 'Choosing Sample Files for Video Repair' },
          { id: 'pv7', title: 'CHKDSK Extension Change Recovery' },
        ],
      },
    ],
  },
  {
    id: 'electronics',
    title: 'Basic Electronics',
    summary: 'Component literacy for PCB diagnosis: capacitor, diode, fuse, coil, multimeter, resistor.',
    modules: [
      {
        id: 'elec',
        title: 'Components',
        lessons: [
          { id: 'el1', title: 'Capacitor' },
          { id: 'el2', title: 'Diode' },
          { id: 'el3', title: 'Fuse' },
          { id: 'el4', title: 'Inductor / Coil' },
          { id: 'el5', title: 'Multimeter' },
          { id: 'el6', title: 'Resistor' },
        ],
      },
    ],
  },
  {
    id: 'basics',
    title: 'Basic Information and Logical Values',
    summary: 'Bits, interfaces, geometry, BIOS/UEFI, and disk types every recovery tech needs.',
    modules: [
      {
        id: 'basics-mod',
        title: 'Foundations',
        lessons: [
          { id: 'b1', title: 'Bit and Byte' },
          { id: 'b2', title: 'SATA and PATA (IDE)' },
          { id: 'b3', title: 'Track, Sector and Cluster' },
          { id: 'b4', title: 'BIOS and UEFI' },
          { id: 'b5', title: 'Basic and Dynamic Disk' },
        ],
      },
    ],
  },
  {
    id: 'bitlocker',
    title: 'BitLocker Drive Data Recovery',
    summary: 'Encryption basics and recovery paths for deleted, formatted, and TPM-linked volumes.',
    modules: [
      {
        id: 'bl',
        title: 'BitLocker',
        lessons: [
          { id: 'bl1', title: 'BitLocker General Information' },
          { id: 'bl2', title: 'Software Level Recovery Process' },
          { id: 'bl3', title: 'Auto BitLocker / TPM 1.2 / Windows 10' },
          { id: 'bl4', title: 'Deleted Partition Recovery' },
          { id: 'bl5', title: 'Formatted Drive Recovery' },
        ],
      },
    ],
  },
];

export const featuredSolutions = [
  {
    id: 'recovery',
    title: 'Data Recovery and Hard Disk Repair',
    text: 'End-to-end training for logical, electrical, and mechanical failures — built for students and working technicians.',
    to: '/training/logical',
  },
  {
    id: 'firmware',
    title: 'Advance Hard Drive Firmware Repairing',
    text: 'From basic firmware concepts to MRT workflows for Seagate and WD families.',
    to: '/training/mrt',
  },
  {
    id: 'electronics',
    title: 'Basic Electronics and Component Testing',
    text: 'Practical PCB literacy so you can diagnose boards before you swap or short pins.',
    to: '/training/electronics',
  },
];

export type DemoCategory = 'logical' | 'electrical' | 'mechanical' | 'firmware';

export const demoVideos = [
  {
    id: 'd1',
    title: 'WD USB My Passport – Charger Family Hang Fix',
    tag: 'Native Solution',
    category: 'logical' as DemoCategory,
    duration: '18 min',
    durationLong: '18:24',
    tags: ['WD', 'USB', 'My Passport', 'Hang Fix'],
    description:
      'Complete step-by-step demo to diagnose and fix the hang issue in WD My Passport (USB) drives.',
    level: 'Intermediate',
    views: '12,480',
    uploaded: '2 months ago',
    featured: true,
  },
  {
    id: 'd2',
    title: 'Lost / Deleted Partition Recovery in Minutes',
    tag: 'Logical',
    category: 'logical' as DemoCategory,
    duration: '12 min',
    durationLong: '12:08',
    tags: ['Partition Recovery', 'Deleted Files', 'Data Recovery'],
    description: 'Recover lost and deleted partitions quickly with a practical logical workflow.',
    level: 'Beginner',
    views: '9,240',
    uploaded: '3 months ago',
  },
  {
    id: 'd3',
    title: 'PCB Component Testing (Basic to Advanced)',
    tag: 'Electrical',
    category: 'electrical' as DemoCategory,
    duration: '16 min',
    durationLong: '16:42',
    tags: ['PCB', 'Multimeter', 'Component Testing'],
    description: 'Learn practical PCB testing methods from basic continuity to advanced diagnosis.',
    level: 'Intermediate',
    views: '7,110',
    uploaded: '1 month ago',
  },
  {
    id: 'd4',
    title: 'Head Replacement – Practical Demo',
    tag: 'Mechanical',
    category: 'mechanical' as DemoCategory,
    duration: '21 min',
    durationLong: '21:15',
    tags: ['Head Stack', 'Cleanroom', 'Mechanical'],
    description: 'Practical head replacement demo covering symptoms, donor matching, and swap flow.',
    level: 'Advanced',
    views: '5,860',
    uploaded: '5 weeks ago',
  },
  {
    id: 'd5',
    title: 'Seagate & WD Firmware Repair (MRT Workflow)',
    tag: 'Firmware',
    category: 'firmware' as DemoCategory,
    duration: '24 min',
    durationLong: '24:03',
    tags: ['Seagate', 'WD', 'MRT', 'Firmware'],
    description: 'MRT-based firmware repair workflow for common Seagate and WD family failures.',
    level: 'Advanced',
    views: '11,020',
    uploaded: '6 weeks ago',
  },
  {
    id: 'd6',
    title: 'Windows 10 Auto BitLocker / TPM 1.2 Case',
    tag: 'Logical',
    category: 'logical' as DemoCategory,
    duration: '20 min',
    durationLong: '20:11',
    tags: ['BitLocker', 'TPM', 'Windows'],
    description: 'Recover BitLocker-protected volumes when TPM and OS unlock paths fail.',
    level: 'Intermediate',
    views: '4,390',
    uploaded: '2 months ago',
  },
];

export const demoCategoryFilters: { id: 'all' | DemoCategory; label: string; count: number }[] = [
  { id: 'all', label: 'All Videos', count: 24 },
  { id: 'logical', label: 'Logical Recovery', count: 8 },
  { id: 'electrical', label: 'Electrical Repair', count: 6 },
  { id: 'mechanical', label: 'Mechanical Repair', count: 4 },
  { id: 'firmware', label: 'Firmware', count: 6 },
];

export const whyLearn = [
  {
    id: 'cyber',
    title: 'For cybersecurity experts',
    text: 'Add disk-level recovery skills when soft deletes, ransomware, and forensic imaging collide.',
  },
  {
    id: 'photo',
    title: 'For photographers',
    text: 'Recover media from cards and drives that fail mid-shoot, including damaged video containers.',
  },
  {
    id: 'it',
    title: 'For IT careers',
    text: 'Turn repair-shop and MSP work into a high-margin specialty with real case workflows.',
  },
  {
    id: 'online',
    title: 'Online advantages',
    text: 'Lifetime portal access, updates, and WhatsApp technical assistance while you practice.',
  },
  {
    id: 'assets',
    title: 'Protect personal assets',
    text: 'Know when DIY is safe and when a drive needs professional imaging first.',
  },
  {
    id: 'institutes',
    title: 'For computer institutes',
    text: 'Extend hardware courses with firmware, PCB, and mechanical modules students can sell.',
  },
];

export const pricing = {
  name: 'Professional Plan',
  was: 5999,
  now: 2500,
  currency: 'INR',
  saleLabel: 'Festival Sale – Up to 60% Off',
  features: [
    '20+ hours of self-study video training',
    '120+ different data recovery solutions',
    'Lifetime web portal access',
    'Training certificate',
    'Hard disk firmware repairing software access',
    'Technical assistance on WhatsApp',
    'One-time pay, lifetime updates',
    'All upcoming course access',
    'Logical, mechanical & electrical (PCB) tracks',
    'Basic information and logical values',
    'Seagate & WD firmware failure training',
    'Basic electronics and component testing',
    'Case study videos & expert solutions',
    'Photo & video recovery training',
    'BitLocker encrypted drive recovery',
    'Advanced MRT introduction, Seagate, WD & extractor',
    'Access anytime — no seat limits',
  ],
};

export const services = [
  'CCTV / DVR drive data recovery',
  'Data destruction & wiping',
  'Encrypted data recovery',
  'Flash data recovery',
  'Hard drive data recovery',
  'Laptop repairing',
  'Mobile data recovery',
  'Scrap hard disk repairing',
  'SSD drive data recovery',
];

export const industries = [
  {
    title: 'IT repair shops',
    text: 'Add recovery as a billed service line with remote backup when cases escalate.',
  },
  {
    title: 'Photography & media',
    text: 'Card and drive recovery for studios that cannot afford shoot-day data loss.',
  },
  {
    title: 'Law & compliance',
    text: 'Careful handling practices for matters that need chain-of-custody awareness.',
  },
  {
    title: 'Education institutes',
    text: 'Curriculum-ready modules for hardware and networking programs.',
  },
  {
    title: 'Enterprises',
    text: 'Internal capability for server, laptop, and encrypted volume incidents.',
  },
  {
    title: 'Home users',
    text: 'Guidance on safe first steps — and when to stop clicking and image the disk.',
  },
];

export const blogPosts = [
  {
    slug: 'when-to-stop-diy-recovery',
    title: 'When to stop DIY and start imaging',
    excerpt: 'Clicking “repair” on a clicking drive can erase your last chance. Here’s a simple decision path.',
    date: '2026-08-12',
  },
  {
    slug: 'pcb-swap-checklist',
    title: 'PCB swap checklist before you power on',
    excerpt: 'ROM matching, adaptive data, and the tests that catch a bad donor board early.',
    date: '2026-07-28',
  },
  {
    slug: 'bitlocker-without-panic',
    title: 'BitLocker recovery without panic',
    excerpt: 'Keys, TPM, deleted partitions — what order to try so you do not wipe recovery options.',
    date: '2026-06-04',
  },
];
