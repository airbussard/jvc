'use client'

import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'

interface Option<T> {
  value: T
  label: string
}

interface GlassSelectProps<T> {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  className?: string
  placeholder?: string
}

export function GlassSelect<T extends string>({
  value,
  onChange,
  options,
  className = '',
  placeholder = 'Auswählen...',
}: GlassSelectProps<T>) {
  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className={`relative ${className}`}>
          <Listbox.Button className="glass-listbox-button w-full">
            <span className="block truncate text-left">
              {selectedOption?.label || placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                  open ? 'rotate-180' : ''
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
          >
            <Listbox.Options className="glass-listbox-options">
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  value={option.value}
                  className={({ active, selected }) =>
                    `glass-listbox-option ${
                      active ? 'bg-primary-50' : ''
                    } ${selected ? 'bg-primary-100' : ''}`
                  }
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? 'font-medium text-primary-900' : 'text-gray-900'
                        }`}
                      >
                        {option.label}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-primary-600">
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}
