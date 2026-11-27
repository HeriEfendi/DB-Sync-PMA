<template>
  <div ref="rootRef" class="relative inline-block">
    <button
      ref="triggerRef"
      type="button"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      :aria-label="ariaLabel"
      :aria-activedescendant="isOpen && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined"
      :disabled="disabled"
      :class="[
        'flex h-[var(--control-height)] w-full items-center justify-between gap-2 rounded-[5px] border border-[#2a2f39] bg-[#101217] px-2.5 text-[12px] text-[#edf0f7] outline-none transition-colors duration-150',
        'hover:border-[#3e4656] focus:border-[#7887ff] focus:ring-2 focus:ring-[var(--primary-light)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        triggerClass,
      ]"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <ChevronUp
        v-if="isOpen && resolvedDirection === 'up'"
        :size="14"
        class="shrink-0 text-[#9ca3af] transition-transform duration-150"
      />
      <ChevronDown
        v-else
        :size="14"
        :class="[
          'shrink-0 text-[#9ca3af] transition-transform duration-150',
          isOpen ? 'rotate-180' : '',
        ]"
      />
    </button>

    <Teleport to="body">
      <ul
        v-if="isOpen"
        ref="menuRef"
        :id="listboxId"
        role="listbox"
        :aria-label="ariaLabel"
        :style="menuStyle"
        class="fixed z-[9999] overflow-y-auto rounded-[6px] border border-[#2e3545] bg-[#181c24] p-1 text-[12px] text-[#edf0f7] shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
      >
        <li
          v-for="(opt, idx) in options"
          :id="`${listboxId}-opt-${idx}`"
          :key="String(opt.value)"
          role="option"
          :aria-selected="isSelected(opt)"
          :class="[
            'flex cursor-pointer items-center justify-between gap-2 rounded-[4px] px-2.5 py-1.5 transition-colors duration-100',
            isSelected(opt)
              ? 'bg-[#2563eb]/20 font-medium text-[#93c5fd]'
              : idx === activeIndex
                ? 'bg-white/10 text-white'
                : 'text-[#d1d5db] hover:bg-white/10 hover:text-white',
          ]"
          @mouseenter="activeIndex = idx"
          @mousedown.prevent="selectOption(opt)"
        >
          <span class="truncate">{{ opt.label }}</span>
          <Check v-if="isSelected(opt)" :size="13" class="shrink-0 text-[#60a5fa]" />
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script>
import { Check, ChevronDown, ChevronUp } from 'lucide-vue-next';

export default {
  name: 'BaseSelect',
  components: {
    Check,
    ChevronDown,
    ChevronUp,
  },
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    options: {
      type: Array,
      default: () => [],
    },
    direction: {
      type: String,
      default: 'auto',
      validator: (val) => ['up', 'down', 'auto'].includes(val),
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    ariaLabel: {
      type: String,
      default: 'Pilih opsi',
    },
    triggerClass: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'change'],
  data() {
    return {
      isOpen: false,
      activeIndex: -1,
      resolvedDirection: 'up',
      menuStyle: {},
      listboxId: `base-select-${Math.random().toString(36).slice(2, 9)}`,
    };
  },
  computed: {
    selectedOption() {
      return this.options.find((opt) => this.isSelected(opt)) || null;
    },
    selectedLabel() {
      return this.selectedOption ? this.selectedOption.label : '';
    },
  },
  beforeUnmount() {
    this.removeListeners();
  },
  methods: {
    isSelected(opt) {
      return String(opt.value) === String(this.modelValue);
    },
    toggle() {
      if (this.disabled) return;
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },
    open() {
      if (this.isOpen || this.disabled) return;
      this.isOpen = true;
      const idx = this.options.findIndex((opt) => this.isSelected(opt));
      this.activeIndex = idx >= 0 ? idx : 0;
      this.$nextTick(() => {
        this.updatePosition();
        this.addListeners();
      });
    },
    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.removeListeners();
    },
    updatePosition() {
      const trigger = this.$refs.triggerRef;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      let dir = this.direction;
      if (dir === 'auto') {
        dir = spaceBelow < 240 && spaceAbove > spaceBelow ? 'up' : 'down';
      }
      this.resolvedDirection = dir;

      const style = {
        left: `${Math.max(8, rect.left)}px`,
        minWidth: `${rect.width}px`,
      };

      if (dir === 'up') {
        style.bottom = `${window.innerHeight - rect.top + 4}px`;
        style.maxHeight = `${Math.max(120, spaceAbove - 12)}px`;
      } else {
        style.top = `${rect.bottom + 4}px`;
        style.maxHeight = `${Math.max(120, spaceBelow - 12)}px`;
      }

      this.menuStyle = style;
    },
    selectOption(opt) {
      this.$emit('update:modelValue', opt.value);
      this.$emit('change', opt.value);
      this.close();
      this.$nextTick(() => {
        this.$refs.triggerRef?.focus();
      });
    },
    onKeydown(e) {
      if (this.disabled) return;
      if (e.key === 'Escape') {
        if (this.isOpen) {
          e.preventDefault();
          this.close();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else if (this.options.length > 0) {
          this.activeIndex = (this.activeIndex + 1) % this.options.length;
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else if (this.options.length > 0) {
          this.activeIndex = (this.activeIndex - 1 + this.options.length) % this.options.length;
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else if (this.activeIndex >= 0 && this.options[this.activeIndex]) {
          this.selectOption(this.options[this.activeIndex]);
        }
      }
    },
    onOutsidePointerDown(e) {
      const root = this.$refs.rootRef;
      const menu = this.$refs.menuRef;
      if (root && root.contains(e.target)) return;
      if (menu && menu.contains(e.target)) return;
      this.close();
    },
    onViewportChange() {
      if (this.isOpen) {
        this.updatePosition();
      }
    },
    addListeners() {
      document.addEventListener('pointerdown', this.onOutsidePointerDown, true);
      window.addEventListener('resize', this.onViewportChange);
      window.addEventListener('scroll', this.onViewportChange, true);
    },
    removeListeners() {
      document.removeEventListener('pointerdown', this.onOutsidePointerDown, true);
      window.removeEventListener('resize', this.onViewportChange);
      window.removeEventListener('scroll', this.onViewportChange, true);
    },
  },
};
</script>
