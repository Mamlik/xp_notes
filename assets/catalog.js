window.LECTURE_CATALOG = {
  "courses": [
    {
      "id": "acos",
      "title": "Архитектура компьютера и Операционные системы",
      "shortTitle": "АКОС",
      "description": "Конспекты по архитектуре компьютера, операционным системам, Linux и низкоуровневой механике.",
      "items": [
        {
          "title": "Прерывания и исключения процессора",
          "description": "Подробный конспект о механизмах исключений, аппаратных прерываний и сигналов: как процессор и ОС реагируют на ошибки выполнения, события от устройств, переходы в ядро, обработчики, APIC/MSI и доставку сигналов в userspace.",
          "tags": [
            "interrupts",
            "exceptions",
            "signals"
          ],
          "href": "lectures/acos/interrupts_exceptions_signals_unified.html",
          "status": "published"
        },
        {
          "title": "Компиляция, линковка. Формат ELF",
          "description": "Превращение C++-кода в исполняемый файл: от препроцессора, компиляции и ассемблирования до статической и динамической линковки, разбирая устройство ELF, механизмы GOT/PLT, RELRO, PIE/ASLR и все этапы запуска программы через ядро и ld.so.",
          "tags": [
            "elf",
            "компиляция",
            "линковка"
          ],
          "href": "lectures/acos/compilation_linking_elf_unified.html",
          "status": "published"
        },
        {
          "title": "Работа с аппаратурой",
          "description": "Базовая карта взаимодействия ОС с устройствами: регистры, MMIO, прерывания и драйверная логика.",
          "tags": [
            "hardware",
            "drivers",
            "interrupts"
          ],
          "href": "lectures/acos/hardware_lec5.html",
          "status": "published"
        },
        {
          "title": "Кеши процессора",
          "description": "Почему память не выглядит плоской: уровни кешей, локальность, промахи и цена доступа к данным.",
          "tags": [
            "cpu",
            "cache",
            "locality"
          ],
          "href": "lectures/acos/cpu_caches_lec6.html",
          "status": "published"
        },
        {
          "title": "NUMA, memory ordering и atomics",
          "description": "Память в многопроцессорных системах: NUMA, порядок операций, барьеры и атомарные примитивы.",
          "tags": [
            "numa",
            "atomics",
            "memory"
          ],
          "href": "lectures/acos/numa_memory_model_sem7.html",
          "status": "published"
        },
        {
          "title": "Примитивы синхронизации",
          "description": "Mutex, spinlock, semaphore, condition variables и типовые ловушки конкурентного кода.",
          "tags": [
            "sync",
            "locks",
            "threads"
          ],
          "href": "lectures/acos/sync_primitives_lec7.html",
          "status": "published"
        },
        {
          "title": "Inter-process communication",
          "description": "Как процессы договариваются между собой: каналы, сокеты, shared memory и сигнальные механики.",
          "tags": [
            "ipc",
            "processes",
            "linux"
          ],
          "href": "lectures/acos/ipc_unified.html",
          "status": "published"
        },
        {
          "title": "Планировщики задач",
          "description": "От классических политик планирования до Linux scheduling, CFS/EEVDF и классов задач.",
          "tags": [
            "scheduling",
            "linux",
            "kernel"
          ],
          "href": "lectures/acos/scheduling_unified.html",
          "status": "published"
        },
        {
          "title": "eBPF",
          "description": "Безопасные программы внутри ядра Linux: verifier, хуки, трассировка и observability.",
          "tags": [
            "ebpf",
            "kernel",
            "tracing"
          ],
          "href": "lectures/acos/ebpf_unified.html",
          "status": "published"
        }
      ]
    },
    {
      "id": "algorithms",
      "title": "Алгоритмы",
      "shortTitle": "Алгосы",
      "description": "Будущий раздел для структур данных, графов, динамики и анализа сложности.",
      "items": [
        {
          "title": "Проверка PR-flow",
          "description": "Тестовый черновик для проверки создания Pull Request из админ-панели.",
          "tags": [
            "test",
            "pr-flow"
          ],
          "href": "lectures/algorithms/pr-flow-check.html",
          "status": "draft"
        },
        {
          "title": "Теория Игр",
          "description": "Базовые принципы теории игр: графовое представление, стратегии, Теоремы Шпрага Гранди; Игра в Ним",
          "tags": [
            "gametheory",
            "nim",
            "grundy"
          ],
          "href": "lectures/algorithms/game_theory_sprague_grundy_notes.html",
          "status": "published"
        },
        {
          "title": "Лемма Бёрнсайда, Теорема Пойа",
          "description": "Лекция о действиях групп на множествах и методах подсчёта объектов с учётом симметрий. Рассматриваются орбиты, стабилизаторы, неподвижные точки, лемма Бёрнсайда, теорема Пойа, а также применения к задачам о раскрасках, ожерельях и симметриях фигур.\nКомбинаторика",
          "tags": [
            "grouptheory",
            "burnside",
            "polya",
            "combinatorics"
          ],
          "href": "lectures/algorithms/burnside_polya_lecture10_notes.html",
          "status": "published"
        },
        {
          "title": "Китайская теорема об остатках",
          "description": "Китайская теорема об остатках: существование и единственность решения системы сравнений, конструктивное восстановление числа по остаткам и обобщение на невзаимно простые модули. Также разбирается алгоритм Гарнера как практический способ восстановления решения в смешанной системе счисления.",
          "tags": [
            "garner",
            "numbertheory",
            "modulararithmetic"
          ],
          "href": "lectures/algorithms/crt_garner_detailed_notes.html",
          "status": "published"
        }
      ]
    },
    {
      "id": "distributed",
      "title": "Распределенные системы",
      "shortTitle": "Распределенные системы",
      "description": "Будущий раздел для сетевого взаимодействия, консенсуса, отказоустойчивости и распределенных вычислений.",
      "items": [
        {
          "title": "тестовый конспект",
          "description": "тестовое содержание",
          "tags": [
            "тестовый-тег-1",
            "тестовый-тег-2"
          ],
          "href": "lectures/distributed/algorithms_documentation-2-.html",
          "status": "draft"
        }
      ]
    }
  ]
};
